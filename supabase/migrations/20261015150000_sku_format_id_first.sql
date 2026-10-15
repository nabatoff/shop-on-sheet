-- Новый формат артикула: ID + КАТЕГОРИЯ + КАПСУЛА + РАЗМЕР, без разделителей
-- Например: 1СВИБЕЛL. Закрепление артикула за строкой сохраняется.

CREATE OR REPLACE FUNCTION public.merch_lines_set_sku()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND coalesce(OLD.sku, '') <> '' THEN
    NEW.sku := OLD.sku;
    RETURN NEW;
  END IF;

  IF coalesce(trim(NEW.sku), '') <> '' THEN
    NEW.sku := trim(NEW.sku);
    RETURN NEW;
  END IF;

  NEW.sku :=
    regexp_replace(trim(NEW.product_id), '\s+', '', 'g')
    || public.sku_name_code(NEW.category)
    || public.sku_name_code(NEW.capsule)
    || upper(regexp_replace(coalesce(NEW.size, ''), '\s+', '', 'g'));
  RETURN NEW;
END;
$$;

-- Разовый пересчёт существующих артикулов в новый формат
ALTER TABLE public.merch_lines DISABLE TRIGGER merch_lines_set_sku;
UPDATE public.merch_lines
SET sku =
  regexp_replace(trim(product_id), '\s+', '', 'g')
  || public.sku_name_code(category)
  || public.sku_name_code(capsule)
  || upper(regexp_replace(coalesce(size, ''), '\s+', '', 'g'));
ALTER TABLE public.merch_lines ENABLE TRIGGER merch_lines_set_sku;

UPDATE public.order_items oi
SET sku = m.sku
FROM public.merch_lines m
WHERE m.product_id = oi.product_id
  AND trim(coalesce(m.size, '')) = trim(coalesce(oi.size, ''));
