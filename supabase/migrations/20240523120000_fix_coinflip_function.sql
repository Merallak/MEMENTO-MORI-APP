CREATE OR REPLACE FUNCTION public.create_coinflip_game(p_bet_amount numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_game_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.coinflip_games (
    host_id,
    bet_amount,
    status,
    is_private,
    expires_at,
    mode
  )
  values (
    v_user_id,
    p_bet_amount,  -- CORRECCIÓN: Usamos el parámetro recibido
    'waiting',
    false,
    now() + interval '1 hour',
    'pvp'
  )
  returning id into v_game_id;

  return v_game_id;
end;
$function$;