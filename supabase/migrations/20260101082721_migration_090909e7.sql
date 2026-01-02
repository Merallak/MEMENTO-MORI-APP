-- ====================================
-- FASE 1: BASE DE DATOS - GAME ROOM
-- ====================================

-- 1. Agregar columna MMC Balance a profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS mmc_balance NUMERIC DEFAULT 0 CHECK (mmc_balance >= 0);

-- 2. Crear tabla de juegos RPS
CREATE TABLE IF NOT EXISTS rps_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  bet_amount NUMERIC NOT NULL CHECK (bet_amount > 0),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'playing', 'finished', 'cancelled')),
  host_move TEXT CHECK (host_move IN ('rock', 'paper', 'scissors')),
  guest_move TEXT CHECK (guest_move IN ('rock', 'paper', 'scissors')),
  winner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 minutes')
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_rps_games_status ON rps_games(status);
CREATE INDEX IF NOT EXISTS idx_rps_games_host ON rps_games(host_id);
CREATE INDEX IF NOT EXISTS idx_rps_games_guest ON rps_games(guest_id);
CREATE INDEX IF NOT EXISTS idx_rps_games_expires ON rps_games(expires_at);

-- 4. RLS Policies
ALTER TABLE rps_games ENABLE ROW LEVEL SECURITY;

-- Policy: Ver salas públicas en espera
CREATE POLICY "Public games visible to all"
ON rps_games FOR SELECT
USING (
  status = 'waiting' 
  AND is_private = false
);

-- Policy: Participantes pueden ver sus propias partidas
CREATE POLICY "Participants can view their games"
ON rps_games FOR SELECT
USING (
  auth.uid() = host_id 
  OR auth.uid() = guest_id
);

-- Policy: Solo host puede crear partidas
CREATE POLICY "Users can create games"
ON rps_games FOR INSERT
WITH CHECK (auth.uid() = host_id);

-- Policy: Solo participantes pueden actualizar sus partidas (para moves)
CREATE POLICY "Participants can update their games"
ON rps_games FOR UPDATE
USING (
  auth.uid() = host_id 
  OR auth.uid() = guest_id
);

COMMENT ON TABLE rps_games IS 'Rock Paper Scissors game sessions for Memento Mori Game Room';
COMMENT ON COLUMN profiles.mmc_balance IS 'Memento Mori Coins balance for gaming';