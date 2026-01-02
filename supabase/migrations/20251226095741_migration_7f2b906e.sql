-- ============================================
-- PROFILES: Políticas RLS completas
-- ============================================
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Allow reading all profiles (for displaying token issuers)
CREATE POLICY "Users can view all profiles" 
  ON public.profiles FOR SELECT 
  USING (true);

-- Allow users to insert their own profile (triggered by auth.users)
CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- ============================================
-- TOKENS: Políticas RLS completas
-- ============================================
DROP POLICY IF EXISTS "Anyone can view tokens" ON public.tokens;
DROP POLICY IF EXISTS "Authenticated users can create tokens" ON public.tokens;
DROP POLICY IF EXISTS "Token issuers can update their tokens" ON public.tokens;

-- Anyone can view all tokens (public market data)
CREATE POLICY "Anyone can view tokens" 
  ON public.tokens FOR SELECT 
  USING (true);

-- Authenticated users can create tokens
CREATE POLICY "Authenticated users can create tokens" 
  ON public.tokens FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

-- Token issuers can update their own tokens
CREATE POLICY "Token issuers can update their tokens" 
  ON public.tokens FOR UPDATE 
  USING (auth.uid() = issuer_id);

-- ============================================
-- HOLDINGS: Políticas RLS completas
-- ============================================
DROP POLICY IF EXISTS "Users can view all holdings" ON public.holdings;
DROP POLICY IF EXISTS "Users can manage their own holdings" ON public.holdings;

-- Users can view all holdings (for market transparency)
CREATE POLICY "Users can view all holdings" 
  ON public.holdings FOR SELECT 
  USING (true);

-- Users can insert/update/delete their own holdings
CREATE POLICY "Users can manage their own holdings" 
  ON public.holdings FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- ORDERS: Políticas RLS completas
-- ============================================
DROP POLICY IF EXISTS "Users can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Users can manage their own orders" ON public.orders;

-- Users can view all orders (order book transparency)
CREATE POLICY "Users can view all orders" 
  ON public.orders FOR SELECT 
  USING (true);

-- Users can insert/update/delete their own orders
CREATE POLICY "Users can manage their own orders" 
  ON public.orders FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);