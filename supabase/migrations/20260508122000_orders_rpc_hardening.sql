-- Harden orders flow:
-- - unique order id generator (no collisions on same second/phone suffix)
-- - strict validation of order items
-- - transactional manual order creation RPC for admin panel

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_total_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_total_check CHECK (total >= 0);

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_quantity_positive_check;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_quantity_positive_check CHECK (quantity > 0);

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_price_nonnegative_check;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_price_nonnegative_check CHECK (price >= 0);

CREATE OR REPLACE FUNCTION public.generate_order_id(p_customer_phone text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_digits text;
  v_suffix text;
BEGIN
  v_digits := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  v_suffix := CASE
    WHEN length(v_digits) >= 4 THEN right(v_digits, 4)
    ELSE lpad(v_digits, 4, '0')
  END;
  RETURN to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSMS') || '-' || v_suffix || '-' || substr(gen_random_uuid()::text, 1, 6);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_customer_order(
  p_customer_name text,
  p_customer_phone text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id text;
  v_total numeric := 0;
  it jsonb;
  v_product_id text;
  v_product_name text;
  v_size text;
  v_quantity int;
  v_price numeric;
BEGIN
  IF length(trim(coalesce(p_customer_name, ''))) = 0 OR length(trim(coalesce(p_customer_phone, ''))) = 0 THEN
    RETURN jsonb_build_object('result', 'error', 'error', 'Необходимо указать имя и телефон');
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('result', 'error', 'error', 'Список товаров заказа пуст');
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := trim(coalesce(it ->> 'productId', ''));
    v_product_name := trim(coalesce(it ->> 'productName', ''));
    v_size := trim(coalesce(it ->> 'size', ''));
    v_quantity := coalesce(nullif(trim(it ->> 'quantity'), '')::int, 0);
    v_price := coalesce(nullif(trim(it ->> 'price'), '')::numeric, 0);

    IF v_product_id = '' THEN
      RETURN jsonb_build_object('result', 'error', 'error', 'В одной из позиций отсутствует productId');
    END IF;
    IF v_quantity <= 0 THEN
      RETURN jsonb_build_object('result', 'error', 'error', 'Количество в позиции должно быть больше 0');
    END IF;
    IF v_price < 0 THEN
      RETURN jsonb_build_object('result', 'error', 'error', 'Цена в позиции не может быть отрицательной');
    END IF;

    v_total := v_total + v_price * v_quantity;
  END LOOP;

  v_order_id := public.generate_order_id(p_customer_phone);

  INSERT INTO public.orders (
    order_id,
    created_at,
    created_at_display,
    customer_name,
    customer_phone,
    status,
    total
  )
  VALUES (
    v_order_id,
    now(),
    to_char(now() AT TIME ZONE 'UTC', 'DD.MM.YYYY HH24:MI:SS'),
    trim(p_customer_name),
    trim(p_customer_phone),
    'Новый',
    v_total
  );

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items (order_id, product_id, product_name, size, quantity, price)
    VALUES (
      v_order_id,
      trim(it ->> 'productId'),
      coalesce(trim(it ->> 'productName'), ''),
      trim(it ->> 'size'),
      coalesce(nullif(trim(it ->> 'quantity'), '')::int, 0),
      coalesce(nullif(trim(it ->> 'price'), '')::numeric, 0)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'result', 'success',
    'orderId', v_order_id,
    'status', 'Новый',
    'total', v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_manual_order(
  p_customer_name text,
  p_customer_phone text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_order_id text;
  v_total numeric := 0;
  it jsonb;
  v_product_id text;
  v_product_name text;
  v_size text;
  v_quantity int;
  v_price numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF length(trim(coalesce(p_customer_name, ''))) = 0 OR length(trim(coalesce(p_customer_phone, ''))) = 0 THEN
    RETURN jsonb_build_object('result', 'error', 'error', 'Необходимо указать имя и телефон');
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('result', 'error', 'error', 'Список товаров заказа пуст');
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := trim(coalesce(it ->> 'productId', ''));
    v_product_name := trim(coalesce(it ->> 'productName', ''));
    v_size := trim(coalesce(it ->> 'size', ''));
    v_quantity := coalesce(nullif(trim(it ->> 'quantity'), '')::int, 0);
    v_price := coalesce(nullif(trim(it ->> 'price'), '')::numeric, 0);

    IF v_product_id = '' OR v_product_name = '' THEN
      RETURN jsonb_build_object('result', 'error', 'error', 'Для каждой позиции обязательны productId и productName');
    END IF;
    IF v_quantity <= 0 THEN
      RETURN jsonb_build_object('result', 'error', 'error', 'Количество в позиции должно быть больше 0');
    END IF;
    IF v_price < 0 THEN
      RETURN jsonb_build_object('result', 'error', 'error', 'Цена в позиции не может быть отрицательной');
    END IF;
    IF v_size = '' THEN
      RETURN jsonb_build_object('result', 'error', 'error', 'Для каждой позиции укажите размер (или one-size)');
    END IF;

    v_total := v_total + v_price * v_quantity;
  END LOOP;

  v_order_id := public.generate_order_id(p_customer_phone);

  INSERT INTO public.orders (
    order_id,
    created_at,
    created_at_display,
    customer_name,
    customer_phone,
    status,
    total
  )
  VALUES (
    v_order_id,
    now(),
    to_char(now() AT TIME ZONE 'UTC', 'DD.MM.YYYY HH24:MI:SS'),
    trim(p_customer_name),
    trim(p_customer_phone),
    'Новый',
    v_total
  );

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items (order_id, product_id, product_name, size, quantity, price)
    VALUES (
      v_order_id,
      trim(it ->> 'productId'),
      trim(it ->> 'productName'),
      trim(it ->> 'size'),
      coalesce(nullif(trim(it ->> 'quantity'), '')::int, 0),
      coalesce(nullif(trim(it ->> 'price'), '')::numeric, 0)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'result', 'success',
    'orderId', v_order_id,
    'status', 'Новый',
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_customer_order(text, text, jsonb) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.create_manual_order(text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.create_manual_order(text, text, jsonb) TO authenticated;
