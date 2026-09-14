
-- =============================================
-- 1. ENUM & ROLES
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');

-- =============================================
-- 2. BASE TABLES
-- =============================================

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User Roles (separate table per security best practice)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Categories
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

-- Products
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  original_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  category TEXT,
  platform TEXT[] DEFAULT '{}',
  rating NUMERIC(3,2) DEFAULT 0,
  release_date DATE,
  publisher TEXT,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- Orders
CREATE TABLE public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status order_status NOT NULL DEFAULT 'pending',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  installments INTEGER DEFAULT 1,
  coupon_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- Order Items
CREATE TABLE public.itens_pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.produtos(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price_at_purchase NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;

-- Coupons
CREATE TABLE public.cupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;

-- Favorites
CREATE TABLE public.favoritos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;

-- Reviews
CREATE TABLE public.avaliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. HELPER FUNCTIONS (SECURITY DEFINER)
-- =============================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- =============================================
-- 4. TRIGGERS
-- =============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_avaliacoes_updated_at BEFORE UPDATE ON public.avaliacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- 5. RLS POLICIES
-- =============================================

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());

-- USER ROLES
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin());

-- CATEGORIAS
CREATE POLICY "Anyone can view categories" ON public.categorias FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.categorias FOR ALL TO authenticated USING (public.is_admin());

-- PRODUTOS
CREATE POLICY "Anyone can view active products" ON public.produtos FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can view all products" ON public.produtos FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can insert products" ON public.produtos FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update products" ON public.produtos FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete products" ON public.produtos FOR DELETE TO authenticated USING (public.is_admin());

-- PEDIDOS
CREATE POLICY "Users can view own orders" ON public.pedidos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own orders" ON public.pedidos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own orders" ON public.pedidos FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage orders" ON public.pedidos FOR ALL TO authenticated USING (public.is_admin());

-- ITENS_PEDIDO
CREATE POLICY "Users can view own order items" ON public.itens_pedido FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedidos WHERE pedidos.id = itens_pedido.order_id AND pedidos.user_id = auth.uid()));
CREATE POLICY "Users can insert own order items" ON public.itens_pedido FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.pedidos WHERE pedidos.id = itens_pedido.order_id AND pedidos.user_id = auth.uid()));
CREATE POLICY "Admins can manage order items" ON public.itens_pedido FOR ALL TO authenticated USING (public.is_admin());

-- CUPONS
CREATE POLICY "Admins can manage coupons" ON public.cupons FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Authenticated can validate coupons" ON public.cupons FOR SELECT TO authenticated USING (is_active = true);

-- FAVORITOS
CREATE POLICY "Users can view own favorites" ON public.favoritos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can add favorites" ON public.favoritos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove favorites" ON public.favoritos FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage favorites" ON public.favoritos FOR ALL TO authenticated USING (public.is_admin());

-- AVALIACOES
CREATE POLICY "Anyone can view approved reviews" ON public.avaliacoes FOR SELECT USING (is_approved = true);
CREATE POLICY "Users can view own reviews" ON public.avaliacoes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create reviews" ON public.avaliacoes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON public.avaliacoes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews" ON public.avaliacoes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage reviews" ON public.avaliacoes FOR ALL TO authenticated USING (public.is_admin());

-- =============================================
-- 6. INDEXES
-- =============================================
CREATE INDEX idx_produtos_category ON public.produtos(category);
CREATE INDEX idx_produtos_is_active ON public.produtos(is_active);
CREATE INDEX idx_pedidos_user_id ON public.pedidos(user_id);
CREATE INDEX idx_pedidos_status ON public.pedidos(status);
CREATE INDEX idx_favoritos_user_id ON public.favoritos(user_id);
CREATE INDEX idx_avaliacoes_product_id ON public.avaliacoes(product_id);
CREATE INDEX idx_avaliacoes_user_id ON public.avaliacoes(user_id);
