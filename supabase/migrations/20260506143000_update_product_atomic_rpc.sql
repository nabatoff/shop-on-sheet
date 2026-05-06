-- Atomic product update for admin panel:
-- - upsert all requested sizes
-- - delete sizes removed from the grid
-- - apply quantity as increment or absolute set

CREATE OR REPLACE FUNCTION public.update_merch_product_atomic(
  p_product_id text,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_size text;
  v_qty int;
  v_set boolean;
  v_requested_sizes text[] := ARRAY[]::text[];
  v_updated int := 0;
  v_added int := 0;
  v_deleted int := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF length(trim(coalesce(p_product_id, ''))) = 0 THEN
    RAISE EXCEPTION 'product_id is required';
  END IF;

  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'p_rows must be non-empty json array';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_size := trim(coalesce(v_row ->> 'size', ''));
    IF trim(coalesce(v_row ->> 'product_id', '')) <> trim(p_product_id) THEN
      RAISE EXCEPTION 'row product_id must match p_product_id';
    END IF;
    IF array_position(v_requested_sizes, v_size) IS NOT NULL THEN
      RAISE EXCEPTION 'duplicate size in payload: %', v_size;
    END IF;
    v_requested_sizes := array_append(v_requested_sizes, v_size);
  END LOOP;

  WITH deleted_rows AS (
    DELETE FROM public.merch_lines m
    WHERE m.product_id = trim(p_product_id)
      AND NOT (trim(coalesce(m.size, '')) = ANY(v_requested_sizes))
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM deleted_rows;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_size := trim(coalesce(v_row ->> 'size', ''));
    v_qty := GREATEST(0, COALESCE(NULLIF(trim(v_row ->> 'quantity'), '')::int, 0));
    v_set := COALESCE((v_row ->> 'set_quantity')::boolean, false);

    UPDATE public.merch_lines m
    SET
      category = COALESCE(v_row ->> 'category', ''),
      name = COALESCE(v_row ->> 'name', ''),
      size = v_size,
      quantity = CASE
        WHEN v_set THEN v_qty
        ELSE GREATEST(0, COALESCE(m.quantity, 0) + v_qty)
      END,
      price = COALESCE(NULLIF(trim(v_row ->> 'price'), '')::numeric, 0),
      image1 = COALESCE(v_row ->> 'image1', ''),
      image2 = COALESCE(v_row ->> 'image2', ''),
      image3 = COALESCE(v_row ->> 'image3', ''),
      image4 = COALESCE(v_row ->> 'image4', ''),
      capsule = COALESCE(v_row ->> 'capsule', ''),
      description = COALESCE(v_row ->> 'description', ''),
      preorder = COALESCE((v_row ->> 'preorder')::boolean, false),
      disabled = COALESCE((v_row ->> 'disabled')::boolean, false)
    WHERE m.product_id = trim(p_product_id)
      AND trim(coalesce(m.size, '')) = v_size;

    IF FOUND THEN
      v_updated := v_updated + 1;
    ELSE
      INSERT INTO public.merch_lines (
        product_id,
        category,
        name,
        size,
        quantity,
        price,
        image1,
        image2,
        image3,
        image4,
        capsule,
        description,
        preorder,
        disabled
      )
      VALUES (
        trim(p_product_id),
        COALESCE(v_row ->> 'category', ''),
        COALESCE(v_row ->> 'name', ''),
        v_size,
        v_qty,
        COALESCE(NULLIF(trim(v_row ->> 'price'), '')::numeric, 0),
        COALESCE(v_row ->> 'image1', ''),
        COALESCE(v_row ->> 'image2', ''),
        COALESCE(v_row ->> 'image3', ''),
        COALESCE(v_row ->> 'image4', ''),
        COALESCE(v_row ->> 'capsule', ''),
        COALESCE(v_row ->> 'description', ''),
        COALESCE((v_row ->> 'preorder')::boolean, false),
        COALESCE((v_row ->> 'disabled')::boolean, false)
      );
      v_added := v_added + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'updated', v_updated,
    'added', v_added,
    'deleted', v_deleted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_merch_product_atomic(text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.update_merch_product_atomic(text, jsonb) TO authenticated;
