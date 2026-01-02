-- Create price_history table for real-time price tracking
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  price DECIMAL(20, 8) NOT NULL,
  market_cap DECIMAL(20, 2) NOT NULL,
  volume_24h DECIMAL(20, 2) DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT price_history_token_timestamp_unique UNIQUE(token_id, timestamp)
);

-- Create index for fast queries by token and time range
CREATE INDEX IF NOT EXISTS idx_price_history_token_timestamp 
ON price_history(token_id, timestamp DESC);

-- Enable RLS
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Public read policy (anyone can view price history)
CREATE POLICY "Anyone can view price history" 
ON price_history FOR SELECT 
USING (true);

-- Only authenticated users can insert price snapshots
CREATE POLICY "Authenticated users can insert price snapshots" 
ON price_history FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Add comment for documentation
COMMENT ON TABLE price_history IS 'Stores historical price snapshots for tokens to enable charting and technical analysis';