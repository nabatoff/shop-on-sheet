-- Артикул строки merch_lines: КАТ-КАПС-ID[-РАЗМЕР], например СВИ-БЕЛ-1-L.
-- Считается триггером при любой записи (RPC, импорт, ручной insert/update).

ALTER TABLE public.merch_lines
  ADD COLUMN IF NOT EXISTS sku text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.sku_name_code(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(left(regexp_replace(coalesce(p_name, ''), '[^[:alnum:]]', '', 'g'), 3));
$$;

CREATE OR REPLACE FUNCTION public.merch_lines_set_sku()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS merch_lines_set_sku ON public.merch_lines;
CREATE TRIGGER merch_lines_set_sku
  BEFORE INSERT OR UPDATE ON public.merch_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.merch_lines_set_sku();

-- Заполнить артикулы у существующих строк (триггер пересчитает sku)
UPDATE public.merch_lines SET product_id = product_id;

CREATE INDEX IF NOT EXISTS idx_merch_lines_sku ON public.merch_lines (sku);
