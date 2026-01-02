-- 1. Función para manejar nuevos usuarios automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger que dispara la función al registrarse
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Sincronizar usuarios "perdidos" (los que ya existen en Auth pero no en Profiles)
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 4. Función eficiente para obtener métricas
CREATE OR REPLACE FUNCTION get_platform_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_count integer;
  token_count integer;
  total_market_cap numeric;
BEGIN
  SELECT count(*) INTO user_count FROM public.profiles;
  SELECT count(*) INTO token_count FROM public.tokens;
  SELECT COALESCE(SUM(market_cap), 0) INTO total_market_cap FROM public.tokens;
  
  RETURN json_build_object(
    'users', user_count,
    'tokens', token_count,
    'marketCap', total_market_cap
  );
END;
$$;