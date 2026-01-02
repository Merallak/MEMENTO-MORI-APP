-- Create trades table for immutable transaction history
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID REFERENCES profiles(id),
  seller_id UUID REFERENCES profiles(id),
  token_id UUID REFERENCES tokens(id) NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  price_per_token NUMERIC NOT NULL CHECK (price_per_token >= 0),
  total_value NUMERIC NOT NULL CHECK (total_value >= 0),
  type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL', 'SWAP')),
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Policies
-- Users can view trades where they are buyer or seller
CREATE POLICY "Users can view their own trades" ON trades
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- System/Users can insert trades (during execution)
CREATE POLICY "System can insert trades" ON trades
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trades_buyer ON trades(buyer_id);
CREATE INDEX IF NOT EXISTS idx_trades_seller ON trades(seller_id);
CREATE INDEX IF NOT EXISTS idx_trades_token ON trades(token_id);
CREATE INDEX IF NOT EXISTS idx_trades_executed_at ON trades(executed_at DESC);