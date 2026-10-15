-- Артикул фиксируется за строкой: генерируется один раз при создании
-- (или берётся из импортируемого файла) и больше не пересчитывается,
-- даже если потом поменяли категорию, капсулу или название.

CREATE OR REPLACE FUNCTION public.merch_lines_set_sku()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
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

  NEW.sku := array_to_string(
    ARRAY(
      SELECT t.part FROM unnest(ARRAY[
        public.sku_name_code(NEW.category),
        public.sku_name_code(NEW.capsule),
        trim(NEW.product_id),
        upper(regexp_replace(coalesce(NEW.size, ''), '\s+', '', 'g'))
      ]) WITH ORDINALITY AS t(part, ord)
      WHERE t.part <> ''
      ORDER BY t.ord
    ),
    '-'
  );
  RETURN NEW;
END;
$$;
