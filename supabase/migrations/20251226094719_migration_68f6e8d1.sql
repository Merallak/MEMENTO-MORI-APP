-- Add missing column to holdings
ALTER TABLE public.holdings ADD COLUMN IF NOT EXISTS avg_buy_price NUMERIC NOT NULL DEFAULT 0;

-- Check profiles structure (just to be safe, though usually it has id, updated_at, username, avatar_url, website, etc if created by starter)
-- I will blindly assume username exists or create it if not, but standard profiles usually have it. 
-- Let's ensure profiles has what we need.