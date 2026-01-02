-- Add flag to track if user has already exchanged equity
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_exchanged_equity BOOLEAN DEFAULT FALSE;

-- Update the exchange function to check and set the flag
CREATE OR REPLACE FUNCTION exchange_equity_for_mmc(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_token_id UUID;
    v_total_supply NUMERIC;
    v_amount_to_deduct NUMERIC;
BEGIN
    -- Check if user has already exchanged
    IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND has_exchanged_equity = TRUE) THEN
        RAISE EXCEPTION 'User has already exchanged equity for MMC';
    END IF;

    -- Get user's issued token
    SELECT id, total_supply INTO v_token_id, v_total_supply
    FROM tokens
    WHERE issuer_id = p_user_id;

    IF v_token_id IS NULL THEN
        RAISE EXCEPTION 'User has not issued a token';
    END IF;

    -- Calculate 1% of total supply
    v_amount_to_deduct := v_total_supply * 0.01;

    -- Deduct 1% from user's holdings
    UPDATE holdings
    SET amount = amount - v_amount_to_deduct
    WHERE user_id = p_user_id AND token_id = v_token_id;

    -- Add 1,000,000 MMC to user's balance
    UPDATE profiles
    SET mmc_balance = mmc_balance + 1000000,
        has_exchanged_equity = TRUE
    WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Exchange successful');
END;
$$;