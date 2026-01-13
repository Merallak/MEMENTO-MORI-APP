begin;

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- ----------------------------
-- TABLE: ttt_games
-- ----------------------------
create table if not exists public.ttt_games (
  id uuid primary key default gen_random_uuid(),

  host_id uuid not null,
  guest_id uuid,

  -- bet_amount is NULL until both agree (same behaviour as RPS)
  bet_amount numeric,

  status text not null default 'waiting', -- waiting | active | playing | finished | cancelled

  -- TicTacToe state
  board text not null default '_________', -- 9 chars: X/O/_
  host_symbol text, -- 'X' or 'O'
  guest_symbol text, -- 'X' or 'O'
  turn_player_id uuid, -- whose turn it is (host_id or guest_id)

  winner_id uuid, -- NULL = draw

  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz,

  game_code text, -- for private games

  -- bet negotiation for next round
  next_bet_amount numeric,
  next_bet_proposer_id uuid,

  round_number integer not null default 1,

  constraint ttt_games_host_id_fkey foreign key (host_id) references public.profiles(id) on delete cascade,
  constraint ttt_games_guest_id_fkey foreign key (guest_id) references public.profiles(id) on delete set null,
  constraint ttt_games_winner_id_fkey foreign key (winner_id) references public.profiles(id) on delete set null,
  constraint ttt_games_turn_player_id_fkey foreign key (turn_player_id) references public.profiles(id) on delete set null,

  constraint ttt_games_status_check check (status in ('waiting','active','playing','finished','cancelled')),
  constraint ttt_games_bet_check check (bet_amount is null or bet_amount > 0),
  constraint ttt_games_next_bet_check check (next_bet_amount is null or next_bet_amount > 0),

  constraint ttt_games_board_check check (
    length(board) = 9 and board ~ '^[XO_]{9}$'
  ),
  constraint ttt_games_symbols_check check (
    (host_symbol is null and guest_symbol is null)
    or
    (host_symbol in ('X','O') and guest_symbol in ('X','O') and host_symbol <> guest_symbol)
  )
);

create unique index if not exists ttt_games_game_code_unique
on public.ttt_games (game_code)
where game_code is not null;

create index if not exists ttt_games_status_idx on public.ttt_games (status);
create index if not exists ttt_games_host_idx on public.ttt_games (host_id);
create index if not exists ttt_games_guest_idx on public.ttt_games (guest_id);

-- Optional: prevent accidental duplicate ledger rows for TTT
create unique index if not exists mmc_ledger_ttt_unique
on public.mmc_ledger (user_id, ref_type, ref_id, reason);

-- ----------------------------
-- RLS
-- ----------------------------
alter table public.ttt_games enable row level security;

drop policy if exists ttt_games_select on public.ttt_games;
create policy ttt_games_select
on public.ttt_games
for select
to authenticated
using (
  status = 'waiting'
  or host_id = auth.uid()
  or guest_id = auth.uid()
);

drop policy if exists ttt_games_update_participants on public.ttt_games;
create policy ttt_games_update_participants
on public.ttt_games
for update
to authenticated
using (host_id = auth.uid() or guest_id = auth.uid())
with check (host_id = auth.uid() or guest_id = auth.uid());

-- ============================================================
-- RPC: create_ttt_game
-- ============================================================
create or replace function public.create_ttt_game(p_bet_amount numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_game_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.ttt_games (host_id, bet_amount, status, is_private, expires_at)
  values (v_user_id, null, 'waiting', false, now() + interval '1 hour')
  returning id into v_game_id;

  return v_game_id;
end;
$$;

grant execute on function public.create_ttt_game(numeric) to authenticated;

-- ============================================================
-- RPC: create_private_ttt_game
-- ============================================================
create or replace function public.create_private_ttt_game(p_bet_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_game_id uuid;
  v_code text;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  loop
    v_code := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from public.ttt_games where game_code = v_code);
  end loop;

  insert into public.ttt_games (host_id, bet_amount, status, is_private, game_code, expires_at)
  values (v_user_id, null, 'waiting', true, v_code, now() + interval '1 hour')
  returning id into v_game_id;

  return jsonb_build_object('success', true, 'game_id', v_game_id, 'game_code', v_code);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.create_private_ttt_game(numeric) to authenticated;

-- ============================================================
-- RPC: join_ttt_game
-- (also initializes random start + random first symbol)
-- ============================================================
create or replace function public.join_ttt_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  g public.ttt_games%rowtype;

  v_start_player uuid;
  v_start_symbol text;
  v_other_symbol text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into g
  from public.ttt_games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'Game not found';
  end if;

  if g.status <> 'waiting' then
    raise exception 'Game is not joinable';
  end if;

  if g.host_id = v_user_id then
    -- host re-entering
    return;
  end if;

  if g.guest_id is not null then
    raise exception 'Game already has a guest';
  end if;

  -- Random start player (host/guest) + random start symbol (X/O)
  v_start_player := case when random() < 0.5 then g.host_id else v_user_id end;
  v_start_symbol := case when random() < 0.5 then 'X' else 'O' end;
  v_other_symbol := case when v_start_symbol = 'X' then 'O' else 'X' end;

  update public.ttt_games
    set guest_id = v_user_id,
        status = 'active',
        board = '_________',
        winner_id = null,
        turn_player_id = v_start_player,
        host_symbol = case when v_start_player = g.host_id then v_start_symbol else v_other_symbol end,
        guest_symbol = case when v_start_player = v_user_id then v_start_symbol else v_other_symbol end
  where id = p_game_id;
end;
$$;

grant execute on function public.join_ttt_game(uuid) to authenticated;

-- ============================================================
-- RPC: join_ttt_game_by_code
-- ============================================================
create or replace function public.join_ttt_game_by_code(p_game_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := upper(trim(p_game_code));
  g public.ttt_games%rowtype;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  select * into g
  from public.ttt_games
  where game_code = v_code
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Invalid code');
  end if;

  if g.status <> 'waiting' then
    return jsonb_build_object('success', false, 'error', 'Game is not joinable');
  end if;

  if g.host_id = v_user_id then
    return jsonb_build_object('success', true, 'game_id', g.id);
  end if;

  if g.guest_id is not null then
    return jsonb_build_object('success', false, 'error', 'Game already has a guest');
  end if;

  perform public.join_ttt_game(g.id);

  return jsonb_build_object('success', true, 'game_id', g.id);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.join_ttt_game_by_code(text) to authenticated;

-- ============================================================
-- RPC: propose_new_ttt_bet
-- ============================================================
create or replace function public.propose_new_ttt_bet(p_game_id uuid, p_new_bet numeric)
returns table(success boolean, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  g public.ttt_games%rowtype;
begin
  if v_user_id is null then
    return query select false, 'Not authenticated';
    return;
  end if;

  if p_new_bet is null or p_new_bet <= 0 then
    return query select false, 'Invalid bet';
    return;
  end if;

  select * into g
  from public.ttt_games
  where id = p_game_id
  for update;

  if not found then
    return query select false, 'Game not found';
    return;
  end if;

  if not (g.host_id = v_user_id or g.guest_id = v_user_id) then
    return query select false, 'Not a participant';
    return;
  end if;

  if g.status <> 'active' then
    return query select false, 'Game not ready for bet negotiation';
    return;
  end if;

  if g.host_id is null or g.guest_id is null then
    return query select false, 'Opponent not joined';
    return;
  end if;

  if g.bet_amount is not null then
    return query select false, 'Bet already set';
    return;
  end if;

  update public.ttt_games
    set next_bet_amount = p_new_bet,
        next_bet_proposer_id = v_user_id
  where id = p_game_id;

  return query select true, null;
exception when others then
  return query select false, sqlerrm;
end;
$$;

grant execute on function public.propose_new_ttt_bet(uuid, numeric) to authenticated;

-- ============================================================
-- RPC: accept_new_ttt_bet (VALIDATE ONLY, no escrow)
-- ============================================================
create or replace function public.accept_new_ttt_bet(p_game_id uuid)
returns table(success boolean, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  g public.ttt_games%rowtype;
  v_bet numeric;
  host_bal numeric;
  guest_bal numeric;
begin
  if v_user_id is null then
    return query select false, 'Not authenticated';
    return;
  end if;

  select * into g
  from public.ttt_games
  where id = p_game_id
  for update;

  if not found then
    return query select false, 'Game not found';
    return;
  end if;

  if g.status <> 'active' then
    return query select false, 'Game not ready';
    return;
  end if;

  if g.host_id is null or g.guest_id is null then
    return query select false, 'Opponent not joined';
    return;
  end if;

  if g.bet_amount is not null then
    return query select false, 'Bet already set';
    return;
  end if;

  if g.next_bet_amount is null or g.next_bet_proposer_id is null then
    return query select false, 'No pending bet proposal';
    return;
  end if;

  if not (g.host_id = v_user_id or g.guest_id = v_user_id) then
    return query select false, 'Not a participant';
    return;
  end if;

  if g.next_bet_proposer_id = v_user_id then
    return query select false, 'Proposer cannot accept their own bet';
    return;
  end if;

  v_bet := g.next_bet_amount;

  select coalesce(mmc_balance, 0) into host_bal from public.profiles where id = g.host_id;
  select coalesce(mmc_balance, 0) into guest_bal from public.profiles where id = g.guest_id;

  if host_bal < v_bet or guest_bal < v_bet then
    return query select false, 'Insufficient MMC';
    return;
  end if;

  update public.ttt_games
    set bet_amount = v_bet,
        next_bet_amount = null,
        next_bet_proposer_id = null
  where id = p_game_id;

  return query select true, null;
exception when others then
  return query select false, sqlerrm;
end;
$$;

grant execute on function public.accept_new_ttt_bet(uuid) to authenticated;

-- ============================================================
-- INTERNAL: resolve_ttt_game (winner + payout)
-- ============================================================
create or replace function public.resolve_ttt_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.ttt_games%rowtype;

  b text;
  w_sym text;
  v_winner uuid;
  v_loser uuid;
  v_bet numeric;
  v_reason text;
  winner_bal numeric;
  loser_bal numeric;

  c1 text; c2 text; c3 text;
begin
  select * into g
  from public.ttt_games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'Game not found';
  end if;

  if g.status = 'finished' then
    return;
  end if;

  if g.bet_amount is null or g.bet_amount <= 0 then
    raise exception 'Bet not set';
  end if;

  b := g.board;

  -- helper-ish: check 3 positions (1-based)
  -- rows
  c1 := substr(b, 1, 1); c2 := substr(b, 2, 1); c3 := substr(b, 3, 1);
  if c1 <> '_' and c1 = c2 and c2 = c3 then w_sym := c1; end if;

  if w_sym is null then
    c1 := substr(b, 4, 1); c2 := substr(b, 5, 1); c3 := substr(b, 6, 1);
    if c1 <> '_' and c1 = c2 and c2 = c3 then w_sym := c1; end if;
  end if;

  if w_sym is null then
    c1 := substr(b, 7, 1); c2 := substr(b, 8, 1); c3 := substr(b, 9, 1);
    if c1 <> '_' and c1 = c2 and c2 = c3 then w_sym := c1; end if;
  end if;

  -- cols
  if w_sym is null then
    c1 := substr(b, 1, 1); c2 := substr(b, 4, 1); c3 := substr(b, 7, 1);
    if c1 <> '_' and c1 = c2 and c2 = c3 then w_sym := c1; end if;
  end if;

  if w_sym is null then
    c1 := substr(b, 2, 1); c2 := substr(b, 5, 1); c3 := substr(b, 8, 1);
    if c1 <> '_' and c1 = c2 and c2 = c3 then w_sym := c1; end if;
  end if;

  if w_sym is null then
    c1 := substr(b, 3, 1); c2 := substr(b, 6, 1); c3 := substr(b, 9, 1);
    if c1 <> '_' and c1 = c2 and c2 = c3 then w_sym := c1; end if;
  end if;

  -- diagonals
  if w_sym is null then
    c1 := substr(b, 1, 1); c2 := substr(b, 5, 1); c3 := substr(b, 9, 1);
    if c1 <> '_' and c1 = c2 and c2 = c3 then w_sym := c1; end if;
  end if;

  if w_sym is null then
    c1 := substr(b, 3, 1); c2 := substr(b, 5, 1); c3 := substr(b, 7, 1);
    if c1 <> '_' and c1 = c2 and c2 = c3 then w_sym := c1; end if;
  end if;

  -- draw (no empty cells) and no winner
  if w_sym is null and position('_' in b) = 0 then
    update public.ttt_games
      set status = 'finished',
          winner_id = null,
          turn_player_id = null
    where id = p_game_id;
    return;
  end if;

  -- no resolution yet
  if w_sym is null then
    return;
  end if;

  -- map winning symbol to player
  v_winner := case when w_sym = g.host_symbol then g.host_id else g.guest_id end;
  v_loser := case when v_winner = g.host_id then g.guest_id else g.host_id end;

  v_bet := g.bet_amount;
  v_reason := format('ttt_round_%s_payout', g.round_number);

  update public.profiles
    set mmc_balance = coalesce(mmc_balance, 0) + v_bet
  where id = v_winner
  returning mmc_balance into winner_bal;

  update public.profiles
    set mmc_balance = coalesce(mmc_balance, 0) - v_bet
  where id = v_loser
  returning mmc_balance into loser_bal;

  insert into public.mmc_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, created_at)
  values
    (v_winner, v_bet,  winner_bal, v_reason, 'ttt_game', p_game_id, now()),
    (v_loser,  -v_bet, loser_bal,  v_reason, 'ttt_game', p_game_id, now());

  update public.ttt_games
    set status = 'finished',
        winner_id = v_winner,
        turn_player_id = null
  where id = p_game_id;
end;
$$;

grant execute on function public.resolve_ttt_game(uuid) to authenticated;

-- ============================================================
-- RPC: submit_ttt_move (p_cell 0..8)
-- ============================================================
create or replace function public.submit_ttt_move(p_game_id uuid, p_cell integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  g public.ttt_games%rowtype;

  v_pos integer;
  v_sym text;
  v_other uuid;
  v_board text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_cell is null or p_cell < 0 or p_cell > 8 then
    raise exception 'Invalid cell';
  end if;

  v_pos := p_cell + 1;

  select * into g
  from public.ttt_games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'Game not found';
  end if;

  if g.status not in ('active','playing') then
    raise exception 'Game not playable';
  end if;

  if g.host_id is null or g.guest_id is null then
    raise exception 'Opponent not joined';
  end if;

  if g.bet_amount is null or g.bet_amount <= 0 then
    raise exception 'Bet not set';
  end if;

  if g.turn_player_id is null or g.turn_player_id <> v_user_id then
    raise exception 'Not your turn';
  end if;

  if not (g.host_id = v_user_id or g.guest_id = v_user_id) then
    raise exception 'Not a participant';
  end if;

  if g.host_symbol is null or g.guest_symbol is null then
    raise exception 'Game not initialized';
  end if;

  v_sym := case when v_user_id = g.host_id then g.host_symbol else g.guest_symbol end;
  v_other := case when v_user_id = g.host_id then g.guest_id else g.host_id end;

  v_board := g.board;

  if substr(v_board, v_pos, 1) <> '_' then
    raise exception 'Cell already taken';
  end if;

  -- place symbol
  v_board := overlay(v_board placing v_sym from v_pos for 1);

  update public.ttt_games
    set board = v_board,
        status = 'playing',
        expires_at = now() + interval '1 hour'
  where id = p_game_id;

  -- resolve if win/draw
  perform public.resolve_ttt_game(p_game_id);

  -- if still not finished, advance turn
  select status into g.status from public.ttt_games where id = p_game_id;

  if g.status <> 'finished' then
    update public.ttt_games
      set turn_player_id = v_other
    where id = p_game_id;
  end if;
end;
$$;

grant execute on function public.submit_ttt_move(uuid, integer) to authenticated;

-- ============================================================
-- RPC: restart_ttt_game (new round, new random starter + symbol)
-- ============================================================
create or replace function public.restart_ttt_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  g public.ttt_games%rowtype;

  v_start_player uuid;
  v_start_symbol text;
  v_other_symbol text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into g
  from public.ttt_games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'Game not found';
  end if;

  if not (g.host_id = v_user_id or g.guest_id = v_user_id) then
    raise exception 'Not a participant';
  end if;

  if g.status <> 'finished' then
    raise exception 'Game is not finished';
  end if;

  if g.host_id is null or g.guest_id is null then
    raise exception 'Opponent not joined';
  end if;

  v_start_player := case when random() < 0.5 then g.host_id else g.guest_id end;
  v_start_symbol := case when random() < 0.5 then 'X' else 'O' end;
  v_other_symbol := case when v_start_symbol = 'X' then 'O' else 'X' end;

  update public.ttt_games
    set status = 'active',
        board = '_________',
        host_symbol = case when v_start_player = g.host_id then v_start_symbol else v_other_symbol end,
        guest_symbol = case when v_start_player = g.guest_id then v_start_symbol else v_other_symbol end,
        turn_player_id = v_start_player,
        winner_id = null,
        bet_amount = null,
        next_bet_amount = null,
        next_bet_proposer_id = null,
        round_number = round_number + 1,
        expires_at = now() + interval '1 hour'
  where id = p_game_id;
end;
$$;

grant execute on function public.restart_ttt_game(uuid) to authenticated;

commit;