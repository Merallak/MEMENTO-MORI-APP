-- Verificar si el trigger existe y crearlo si falta (medida de seguridad)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END
$$;

-- Asegurar permisos de ejecución para las métricas
GRANT EXECUTE ON FUNCTION get_platform_metrics() TO anon, authenticated, service_role;

-- Prueba final de la función de métricas
SELECT * FROM get_platform_metrics();