-- Habilitar RLS en la tabla coinflip_games (si no estaba ya habilitado)
ALTER TABLE "public"."coinflip_games" ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas anteriores para evitar conflictos si se vuelve a correr
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."coinflip_games";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."coinflip_games";
DROP POLICY IF EXISTS "Enable update for players" ON "public"."coinflip_games";

-- 1. Permitir lectura pública (CRÍTICO: esto hace que aparezca en el Lobby para todos)
CREATE POLICY "Enable read access for all users"
ON "public"."coinflip_games"
FOR SELECT
TO public
USING (true);

-- 2. Permitir crear juegos a usuarios logueados
CREATE POLICY "Enable insert for authenticated users only"
ON "public"."coinflip_games"
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. Permitir actualizar el juego a los participantes (Host, Guest, o si Guest está vacío para unirse)
CREATE POLICY "Enable update for players"
ON "public"."coinflip_games"
FOR UPDATE
TO authenticated
USING ( 
  (auth.uid() = host_id) OR 
  (auth.uid() = guest_id) OR 
  (guest_id IS NULL) 
);