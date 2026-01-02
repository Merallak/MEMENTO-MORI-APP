ALTER TABLE profiles ADD COLUMN IF NOT EXISTS usd_balance numeric NOT NULL DEFAULT 0;
COMMENT ON COLUMN profiles.usd_balance IS 'User fiat balance in USD for trading';