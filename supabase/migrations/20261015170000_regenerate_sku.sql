-- Ручная перегенерация артикулов товара (все размеры) по текущим данным.
-- Обычные обновления по-прежнему не трогают закреплённый артикул.

CREATE OR REPLACE FUNCTION public.merch_lines_set_sku()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_regen boolean := coalesce(current_setting('app.regenerate_sku', true), '') = 'on';
BEGIN
  IF NOT v_regen THEN
    -- Уже закреплённый артикул не меняется
    IF TG_OP = 'UPDATE' AND coalesce(OLD.sku, '') <> '' THEN
      NEW.sku := OLD.sku;
      RETURN NEW;
    END IF;

    -- Артикул передан явно (например, из файла импорта) — оставляем его
    IF coalesce(trim(NEW.sku), '') <> '' THEN
      NEW.sku := trim(NEW.sku);
      RETURN NEW;
    END IF;
  END IF;

  NEW.sku :=
    regexp_replace(trim(NEW.product_id), '\s+', '', 'g')
    || public.sku_full_code(NEW.category)
    || public.sku_name_code(NEW.capsule)
    || upper(regexp_replace(coalesce(NEW.size, ''), '\s+', '', 'g'));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.regenerate_merch_sku(p_product_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF length(trim(coalesce(p_product_id, ''))) = 0 THEN
    RAISE EXCEPTION 'product_id is required';
  END IF;

  PERFORM set_config('app.regenerate_sku', 'on', true);
  UPDATE public.merch_lines
  SET sku = ''
  WHERE product_id = trim(p_product_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM set_config('app.regenerate_sku', 'off', true);

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.regenerate_merch_sku(text) FROM public;
GRANT EXECUTE ON FUNCTION public.regenerate_merch_sku(text) TO authenticated;
