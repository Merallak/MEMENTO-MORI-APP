-- Verificar y recrear la política de INSERT para tokens con mejor lógica
DROP POLICY IF EXISTS "Authenticated users can create tokens" ON public.tokens;

-- Crear política más explícita: el usuario autenticado puede crear tokens donde él es el issuer
CREATE POLICY "Users can create their own tokens" 
  ON public.tokens 
  FOR INSERT 
  WITH CHECK (auth.uid() = issuer_id);

-- Verificar que la política de SELECT permite ver todos los tokens
DROP POLICY IF EXISTS "Anyone can view tokens" ON public.tokens;
CREATE POLICY "Anyone can view all tokens" 
  ON public.tokens 
  FOR SELECT 
  USING (true);