-- Shop catalog migrated from Google Sheets / Apps Script
-- Auth: Supabase Auth + profiles.is_admin

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

CREATE POLICY profiles_select_self ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, is_admin)
  VALUES (NEW.id, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- Справочники (как листы Категории / Размеры / Капсулы)
CREATE TABLE IF NOT EXISTS public.catalog_categories (
  name text PRIMARY KEY,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.catalog_sizes (
  name text PRIMARY KEY,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.catalog_capsules (
  name text PRIMARY KEY,
  color text NOT NULL DEFAULT '#0047BB',
  prefix text NOT NULL DEFAULT 'Капсула',
  outline boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0
);

-- Строки Merch (одна строка = один product_id + размер)
CREATE TABLE IF NOT EXISTS public.merch_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  category text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  size text NOT NULL DEFAULT '',
  quantity int NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  image1 text NOT NULL DEFAULT '',
  image2 text NOT NULL DEFAULT '',
  image3 text NOT NULL DEFAULT '',
  image4 text NOT NULL DEFAULT '',
  capsule text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  preorder boolean NOT NULL DEFAULT false,
  disabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT merch_lines_product_size UNIQUE (product_id, size)
);

CREATE INDEX IF NOT EXISTS idx_merch_lines_product_id ON public.merch_lines (product_id);
CREATE INDEX IF NOT EXISTS idx_merch_lines_capsule ON public.merch_lines (capsule);

CREATE TABLE IF NOT EXISTS public.banner_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order int NOT NULL DEFAULT 0,
  image_url text NOT NULL,
  slide_text text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  date_display text NOT NULL DEFAULT '',
  time_display text NOT NULL DEFAULT '',
  action text NOT NULL,
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.orders (
  order_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_at_display text NOT NULL DEFAULT '',
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  status text NOT NULL DEFAULT 'Новый',
  total numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES public.orders (order_id) ON DELETE CASCADE,
  product_id text NOT NULL,
  product_name text NOT NULL DEFAULT '',
  size text NOT NULL DEFAULT '',
  quantity int NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items (order_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS merch_lines_updated ON public.merch_lines;
CREATE TRIGGER merch_lines_updated
  BEFORE UPDATE ON public.merch_lines
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- Остатки: как в Code.gs — при «Выполнен» минус, при «Отмена» после «Выполнен» плюс
CREATE OR REPLACE FUNCTION public.orders_stock_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'Выполнен' AND OLD.status IS DISTINCT FROM 'Выполнен' THEN
    FOR r IN SELECT * FROM public.order_items WHERE order_id = NEW.order_id LOOP
      UPDATE public.merch_lines m
      SET quantity = GREATEST(0, m.quantity - r.quantity)
      WHERE m.product_id = r.product_id
        AND trim(coalesce(m.size, '')) = trim(coalesce(r.size, ''));
    END LOOP;
  END IF;

  IF NEW.status = 'Отмена' AND OLD.status = 'Выполнен' THEN
    FOR r IN SELECT * FROM public.order_items WHERE order_id = NEW.order_id LOOP
      UPDATE public.merch_lines m
      SET quantity = m.quantity + r.quantity
      WHERE m.product_id = r.product_id
        AND trim(coalesce(m.size, '')) = trim(coalesce(r.size, ''));
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_stock_trigger ON public.orders;
CREATE TRIGGER orders_stock_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE PROCEDURE public.orders_stock_on_status_change();

-- Публичное создание заказа (витрина без авторизации)
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
  v_digits text;
  v_suffix text;
BEGIN
  IF length(trim(coalesce(p_customer_name, ''))) = 0 OR length(trim(coalesce(p_customer_phone, ''))) = 0 THEN
    RETURN jsonb_build_object('result', 'error', 'error', 'Необходимо указать имя и телефон');
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('result', 'error', 'error', 'Список товаров заказа пуст');
  END IF;

  v_digits := regexp_replace(p_customer_phone, '\D', '', 'g');
  v_suffix := CASE WHEN length(v_digits) >= 4 THEN right(v_digits, 4) ELSE lpad(v_digits, 4, '0') END;
  v_order_id := to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISS') || '-' || v_suffix;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total := v_total
      + coalesce(nullif(trim(it ->> 'price'), '')::numeric, 0)
      * coalesce(nullif(trim(it ->> 'quantity'), '')::int, 0);
  END LOOP;

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

GRANT EXECUTE ON FUNCTION public.create_customer_order(text, text, jsonb) TO anon, authenticated;

-- RLS
ALTER TABLE public.catalog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_capsules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merch_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banner_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalog_categories_read ON public.catalog_categories
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY catalog_categories_admin ON public.catalog_categories
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY catalog_sizes_read ON public.catalog_sizes
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY catalog_sizes_admin ON public.catalog_sizes
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY catalog_capsules_read ON public.catalog_capsules
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY catalog_capsules_admin ON public.catalog_capsules
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY merch_lines_select ON public.merch_lines
  FOR SELECT TO anon, authenticated
  USING (disabled = false OR public.is_admin());

CREATE POLICY merch_lines_write_admin ON public.merch_lines
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY merch_lines_update_admin ON public.merch_lines
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY merch_lines_delete_admin ON public.merch_lines
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY banner_slides_read ON public.banner_slides
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY banner_slides_admin ON public.banner_slides
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY site_settings_read ON public.site_settings
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY site_settings_admin ON public.site_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY admin_logs_admin ON public.admin_logs
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY orders_admin_select ON public.orders
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY orders_admin_ins ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY orders_admin_upd ON public.orders
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY orders_admin_del ON public.orders
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY order_items_admin_select ON public.order_items
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY order_items_admin_ins ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY order_items_admin_upd ON public.order_items
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY order_items_admin_del ON public.order_items
  FOR DELETE TO authenticated
  USING (public.is_admin());
