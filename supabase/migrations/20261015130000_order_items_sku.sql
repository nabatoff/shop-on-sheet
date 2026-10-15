-- Артикул в позиции заказа: фиксируется в момент оформления (снимок merch_lines.sku)

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS sku text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.order_items_set_sku()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(NEW.sku, '') = '' THEN
    SELECT m.sku INTO NEW.sku
    FROM public.merch_lines m
    WHERE m.product_id = NEW.product_id
      AND trim(coalesce(m.size, '')) = trim(coalesce(NEW.size, ''))
    LIMIT 1;
    NEW.sku := coalesce(NEW.sku, '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_items_set_sku ON public.order_items;
CREATE TRIGGER order_items_set_sku
  BEFORE INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.order_items_set_sku();

-- Заполнить у существующих позиций
UPDATE public.order_items oi
SET sku = m.sku
FROM public.merch_lines m
WHERE oi.sku = ''
  AND m.product_id = oi.product_id
  AND trim(coalesce(m.size, '')) = trim(coalesce(oi.size, ''));
