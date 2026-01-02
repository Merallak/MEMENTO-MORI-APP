-- Create tokens table
CREATE TABLE IF NOT EXISTS public.tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issuer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ticker TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  net_worth NUMERIC NOT NULL DEFAULT 0,
  total_supply NUMERIC NOT NULL DEFAULT 1000000,
  current_price NUMERIC NOT NULL DEFAULT 0,
  market_cap NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tokens
CREATE POLICY "Anyone can view tokens" ON public.tokens FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create tokens" ON public.tokens FOR INSERT WITH CHECK (auth.uid() = issuer_id);
CREATE POLICY "Users can update their own tokens" ON public.tokens FOR UPDATE USING (auth.uid() = issuer_id);
CREATE POLICY "Users can delete their own tokens" ON public.tokens FOR DELETE USING (auth.uid() = issuer_id);

-- Create holdings table
CREATE TABLE IF NOT EXISTS public.holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, token_id)
);

-- Enable RLS
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for holdings
CREATE POLICY "Users can view their own holdings" ON public.holdings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can manage holdings" ON public.holdings FOR ALL USING (true);

-- Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  amount NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orders
CREATE POLICY "Anyone can view orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Users can create their own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own orders" ON public.orders FOR UPDATE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tokens_issuer ON public.tokens(issuer_id);
CREATE INDEX IF NOT EXISTS idx_holdings_user ON public.holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_token ON public.holdings(token_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_token ON public.orders(token_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);