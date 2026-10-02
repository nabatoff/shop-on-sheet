-- Allow Усть-Каменогорск as order city
CREATE OR REPLACE FUNCTION public.create_customer_order(
  p_customer_name text,
  p_customer_phone text,
  p_items jsonb,
  p_customer_city text DEFAULT ''
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
  v_quantity int;
  v_price numeric;
  v_city text;
BEGIN
  IF length(trim(coalesce(p_customer_name, ''))) = 0 OR length(trim(coalesce(p_customer_phone, ''))) = 0 THEN
    RETURN jsonb_build_object('result', 'error', 'error', 'Необходимо указать имя и телефон');
  END IF;

  v_city := trim(coalesce(p_customer_city, ''));
  IF v_city NOT IN ('Уральск', 'Алматы', 'Астана', 'Усть-Каменогорск') THEN
    RETURN jsonb_build_object('result', 'error', 'error', 'Выберите город: Уральск, Алматы, Астана или Усть-Каменогорск');
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('result', 'error', 'error', 'Список товаров заказа пуст');
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := trim(coalesce(it ->> 'productId', ''));
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
    customer_city,
    status,
    total
  )
  VALUES (
    v_order_id,
    now(),
    to_char(now() AT TIME ZONE 'UTC', 'DD.MM.YYYY HH24:MI:SS'),
    trim(p_customer_name),
    trim(p_customer_phone),
    v_city,
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
    'total', v_total,
    'city', v_city
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_manual_order(
  p_customer_name text,
  p_customer_phone text,
  p_items jsonb,
  p_customer_city text DEFAULT ''
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
  v_city text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF length(trim(coalesce(p_customer_name, ''))) = 0 OR length(trim(coalesce(p_customer_phone, ''))) = 0 THEN
    RETURN jsonb_build_object('result', 'error', 'error', 'Необходимо указать имя и телефон');
  END IF;

  v_city := trim(coalesce(p_customer_city, ''));
  IF v_city <> '' AND v_city NOT IN ('Уральск', 'Алматы', 'Астана', 'Усть-Каменогорск') THEN
    RETURN jsonb_build_object('result', 'error', 'error', 'Город: Уральск, Алматы, Астана или Усть-Каменогорск');
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
    customer_city,
    status,
    total
  )
  VALUES (
    v_order_id,
    now(),
    to_char(now() AT TIME ZONE 'UTC', 'DD.MM.YYYY HH24:MI:SS'),
    trim(p_customer_name),
    trim(p_customer_phone),
    v_city,
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
    'total', v_total,
    'city', v_city
  );
END;
$$;
