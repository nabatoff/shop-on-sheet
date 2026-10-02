-- Simple sequential order numbers: 1, 2, 3, ...
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq
  AS bigint
  INCREMENT BY 1
  MINVALUE 1
  START WITH 1
  CACHE 1;

-- Continue after existing count so new shop doesn't restart at 1 if preferred;
-- start from GREATEST(1, count+1) for a clean sequential counter going forward.
SELECT setval(
  'public.order_number_seq',
  GREATEST(1, (SELECT COUNT(*)::bigint FROM public.orders)),
  true
);

CREATE OR REPLACE FUNCTION public.generate_order_id(p_customer_phone text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
BEGIN
  -- p_customer_phone kept for API compatibility; numbering is global sequential
  RETURN nextval('public.order_number_seq')::text;
END;
$$;
