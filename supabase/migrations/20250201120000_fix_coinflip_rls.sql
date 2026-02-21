-- Habilitar RLS en la tabla (por seguridad, si no lo estaba ya)
ALTER TABLE coinflip_games ENABLE ROW LEVEL SECURITY;

-- 1. Permitir a todos ver los juegos (necesario para el Lobby)
DROP POLICY IF EXISTS "Anyone can view coinflip games" ON coinflip_games;
CREATE POLICY "Anyone can view coinflip games"
ON coinflip_games FOR SELECT
USING (true);

-- 2. Permitir a usuarios autenticados crear juegos
DROP POLICY IF EXISTS "Authenticated users can create coinflip games" ON coinflip_games;
CREATE POLICY "Authenticated users can create coinflip games"
ON coinflip_games FOR INSERT
WITH CHECK (auth.uid() = host_id);

-- 3. Permitir actualizar el juego (unirse, jugar, cancelar) a los participantes o si está libre
DROP POLICY IF EXISTS "Players can update their coinflip games" ON coinflip_games;
CREATE POLICY "Players can update their coinflip games"
ON coinflip_games FOR UPDATE
USING (
  auth.uid() = host_id OR 
  auth.uid() = guest_id OR 
  guest_id IS NULL
);