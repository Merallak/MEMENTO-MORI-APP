-- Add game_code column for private games
ALTER TABLE rps_games ADD COLUMN IF NOT EXISTS game_code TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rps_games_game_code ON rps_games(game_code) WHERE game_code IS NOT NULL;

-- Add is_private flag to distinguish between public and private games
ALTER TABLE rps_games ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- Campos para propuesta de nueva apuesta
ALTER TABLE rps_games ADD COLUMN IF NOT EXISTS next_bet_amount numeric;
ALTER TABLE rps_games ADD COLUMN IF NOT EXISTS next_bet_proposer_id uuid;

-- Function to create private game with a shareable code
CREATE OR REPLACE FUNCTION create_private_rps_game(p_bet_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_game_id uuid;
    v_game_code text;
    v_user_balance numeric;
BEGIN
    -- Check user has enough MMC
    SELECT mmc_balance INTO v_user_balance
    FROM profiles
    WHERE id = auth.uid();

    IF v_user_balance < p_bet_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient MMC balance');
    END IF;

    -- Generate unique 6-character game code
    v_game_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));

    -- Deduct bet from host
    UPDATE profiles
    SET mmc_balance = mmc_balance - p_bet_amount
    WHERE id = auth.uid();

    -- Create game
    INSERT INTO rps_games (host_id, bet_amount, status, game_code, is_private, expires_at)
    VALUES (auth.uid(), p_bet_amount, 'waiting', v_game_code, true, now() + interval '30 minutes')
    RETURNING id INTO v_game_id;

    RETURN jsonb_build_object('success', true, 'game_id', v_game_id, 'game_code', v_game_code);
END;
$$;

-- Function to join game by code
CREATE OR REPLACE FUNCTION join_rps_game_by_code(p_game_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_game rps_games;
    v_user_balance numeric;
BEGIN
    -- Find game by code
    SELECT * INTO v_game
    FROM rps_games
    WHERE game_code = upper(p_game_code)
    AND status = 'waiting'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Game not found or already started');
    END IF;

    -- Check if user is trying to join their own game
    IF v_game.host_id = auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot join your own game');
    END IF;

    -- Check user has enough MMC
    SELECT mmc_balance INTO v_user_balance
    FROM profiles
    WHERE id = auth.uid();

    IF v_user_balance < v_game.bet_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient MMC balance');
    END IF;

    -- Deduct bet from guest
    UPDATE profiles
    SET mmc_balance = mmc_balance - v_game.bet_amount
    WHERE id = auth.uid();

    -- Update game
    UPDATE rps_games
    SET guest_id = auth.uid(),
        status = 'active'
    WHERE id = v_game.id;

    RETURN jsonb_build_object('success', true, 'game_id', v_game.id);
END;
$$;

GRANT EXECUTE ON FUNCTION create_private_rps_game TO authenticated;
GRANT EXECUTE ON FUNCTION join_rps_game_by_code TO authenticated;

-- Proponer nueva apuesta (solo con partida finalizada)
CREATE OR REPLACE FUNCTION propose_new_bet(p_game_id uuid, p_new_bet numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_game rps_games;
BEGIN
    SELECT * INTO v_game
    FROM rps_games
    WHERE id = p_game_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Game not found');
    END IF;

    -- Solo jugadores de la partida pueden proponer
    IF auth.uid() IS DISTINCT FROM v_game.host_id
       AND auth.uid() IS DISTINCT FROM v_game.guest_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not a player of this game');
    END IF;

    -- Solo se puede proponer con partida finalizada
    IF v_game.status <> 'finished' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bet can only be changed after game is finished');
    END IF;

    IF p_new_bet <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bet must be greater than zero');
    END IF;

    UPDATE rps_games
    SET next_bet_amount = p_new_bet,
        next_bet_proposer_id = auth.uid()
    WHERE id = p_game_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Aceptar nueva apuesta (solo el jugador que no propuso)
CREATE OR REPLACE FUNCTION accept_new_bet(p_game_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_game rps_games;
    v_other_player uuid;
BEGIN
    SELECT * INTO v_game
    FROM rps_games
    WHERE id = p_game_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Game not found');
    END IF;

    -- Debe haber una propuesta pendiente
    IF v_game.next_bet_amount IS NULL OR v_game.next_bet_proposer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No pending bet proposal');
    END IF;

    -- Solo jugadores de la partida pueden aceptar
    IF auth.uid() IS DISTINCT FROM v_game.host_id
       AND auth.uid() IS DISTINCT FROM v_game.guest_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not a player of this game');
    END IF;

    -- Determinar el otro jugador (el que NO propuso)
    IF v_game.next_bet_proposer_id = v_game.host_id THEN
        v_other_player := v_game.guest_id;
    ELSIF v_game.next_bet_proposer_id = v_game.guest_id THEN
        v_other_player := v_game.host_id;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid bet proposer');
    END IF;

    -- Solo el jugador que no propuso puede aceptar
    IF auth.uid() IS DISTINCT FROM v_other_player THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the other player can accept the new bet');
    END IF;

    -- Solo se puede aceptar con partida finalizada
    IF v_game.status <> 'finished' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bet can only be accepted after game is finished');
    END IF;

    UPDATE rps_games
    SET bet_amount = v_game.next_bet_amount,
        next_bet_amount = NULL,
        next_bet_proposer_id = NULL
    WHERE id = p_game_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION propose_new_bet TO authenticated;
GRANT EXECUTE ON FUNCTION accept_new_bet TO authenticated;