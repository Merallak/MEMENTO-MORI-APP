begin;

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- ----------------------------
-- DROP OLD (safe if missing)
-- ----------------------------
drop function if exists public.create_rps_game(numeric);
drop function if exists public.create_private_rps_game(numeric);
drop function if exists public.join_rps_game(uuid);
drop function if exists public.join_rps_game_by_code(text);
drop function if exists public.propose_new_bet(uuid, numeric);
drop function if exists public.accept_new_bet(uuid);
drop function if exists public.submit_rps_move(uuid, text);
drop function if exists public.restart_rps_game(uuid);
drop function if exists public.resolve_rps_game(uuid);

drop table if exists public.rps_games cascade;

-- ----------------------------
-- TABLE: rps_games (rebuild)
-- ----------------------------
create table public.rps_games (
  id uuid primary key default gen_random_uuid(),

  host_id uuid not null,
  guest_id uuid,

  -- bet_amount is NULL until both agree (UI expects this)
  bet_amount numeric,

  status text not null default 'waiting', -- waiting | active | playing | finished | cancelled

  host_move text,
  guest_move text,

  winner_id uuid, -- NULL = draw

  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz,

  game_code text, -- for private games

  -- bet negotiation for next round (UI uses these)
  next_bet_amount numeric,
  next_bet_proposer_id uuid,

  -- internal round counter so multiple rounds can be tracked
  round_number integer not null default 1,

  constraint rps_games_host_id_fkey foreign key (host_id) references public.profiles(id) on delete cascade,
  constraint rps_games_guest_id_fkey foreign key (guest_id) references public.profiles(id) on delete set null,
  constraint rps_games_winner_id_fkey foreign key (winner_id) references public.profiles(id) on delete set null,

  constraint rps_games_status_check check (status in ('waiting','active','playing','finished','cancelled')),

  constraint rps_games_move_check check (
    (host_move is null or host_move in ('rock','paper','scissors')) and
    (guest_move is null or guest_move in ('rock','paper','scissors'))
  ),

  constraint rps_games_bet_check check (bet_amount is null or bet_amount > 0),
  constraint rps_games_next_bet_check check (next_bet_amount is null or next_bet_amount > 0)
);

create unique index rps_games_game_code_unique
on public.rps_games (game_code)
where game_code is not null;

create index rps_games_status_idx on public.rps_games (status);
create index rps_games_host_idx on public.rps_games (host_id);
create index rps_games_guest_idx on public.rps_games (guest_id);

-- ----------------------------
-- RLS (frontend reads + some updates)
-- ----------------------------
alter table public.rps_games enable row level security;

drop policy if exists rps_games_select on public.rps_games;
create policy rps_games_select
on public.rps_games
for select
to authenticated
using (
  status = 'waiting'
  or host_id = auth.uid()
  or guest_id = auth.uid()
);

drop policy if exists rps_games_update_participants on public.rps_games;
create policy rps_games_update_participants
on public.rps_games
for update
to authenticated
using (host_id = auth.uid() or guest_id = auth.uid())
with check (host_id = auth.uid() or guest_id = auth.uid());

-- ----------------------------
-- Optional: help prevent accidental duplicate ledger rows
-- (No data loss; only index)
-- ----------------------------
create unique index if not exists mmc_ledger_rps_unique
on public.mmc_ledger (user_id, ref_type, ref_id, reason);

-- ============================================================
-- RPC: create_rps_game
-- ============================================================
create or replace function public.create_rps_game(p_bet_amount numeric)
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

  -- UI creates with 0 => we treat as "no bet yet"
  insert into public.rps_games (host_id, bet_amount, status, is_private, expires_at)
  values (v_user_id, null, 'waiting', false, now() + interval '1 hour')
  returning id into v_game_id;

  return v_game_id;
end;
$$;

grant execute on function public.create_rps_game(numeric) to authenticated;

-- ============================================================
-- RPC: create_private_rps_game
-- ============================================================
create or replace function public.create_private_rps_game(p_bet_amount numeric)
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
    exit when not exists (select 1 from public.rps_games where game_code = v_code);
  end loop;

  insert into public.rps_games (host_id, bet_amount, status, is_private, game_code, expires_at)
  values (v_user_id, null, 'waiting', true, v_code, now() + interval '1 hour')
  returning id into v_game_id;

  return jsonb_build_object('success', true, 'game_id', v_game_id, 'game_code', v_code);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.create_private_rps_game(numeric) to authenticated;

-- ============================================================
-- RPC: join_rps_game
-- ============================================================
create or replace function public.join_rps_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  g public.rps_games%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into g
  from public.rps_games
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

  update public.rps_games
    set guest_id = v_user_id,
        status = 'active'
  where id = p_game_id;
end;
$$;

grant execute on function public.join_rps_game(uuid) to authenticated;

-- ============================================================
-- RPC: join_rps_game_by_code
-- ============================================================
create or replace function public.join_rps_game_by_code(p_game_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := upper(trim(p_game_code));
  g public.rps_games%rowtype;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  select * into g
  from public.rps_games
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

  update public.rps_games
    set guest_id = v_user_id,
        status = 'active'
  where id = g.id;

  return jsonb_build_object('success', true, 'game_id', g.id);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.join_rps_game_by_code(text) to authenticated;

-- ============================================================
-- RPC: propose_new_bet
-- ============================================================
create or replace function public.propose_new_bet(p_game_id uuid, p_new_bet numeric)
returns table(success boolean, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  g public.rps_games%rowtype;
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
  from public.rps_games
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

  if g.host_move is not null or g.guest_move is not null then
    return query select false, 'Round already started';
    return;
  end if;

  update public.rps_games
    set next_bet_amount = p_new_bet,
        next_bet_proposer_id = v_user_id
  where id = p_game_id;

  return query select true, null;
exception when others then
  return query select false, sqlerrm;
end;
$$;

grant execute on function public.propose_new_bet(uuid, numeric) to authenticated;

-- ============================================================
-- RPC: accept_new_bet (VALIDATE ONLY, no escrow)
-- ============================================================
create or replace function public.accept_new_bet(p_game_id uuid)
returns table(success boolean, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  g public.rps_games%rowtype;
  v_bet numeric;
  host_bal numeric;
  guest_bal numeric;
begin
  if v_user_id is null then
    return query select false, 'Not authenticated';
    return;
  end if;

  select * into g
  from public.rps_games
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

  -- Non-proposer must accept
  if g.next_bet_proposer_id = v_user_id then
    return query select false, 'Proposer cannot accept their own bet';
    return;
  end if;

  v_bet := g.next_bet_amount;

  -- Validate both have enough MMC NOW (no escrow, just validation)
  select coalesce(mmc_balance, 0) into host_bal from public.profiles where id = g.host_id;
  select coalesce(mmc_balance, 0) into guest_bal from public.profiles where id = g.guest_id;

  if host_bal < v_bet or guest_bal < v_bet then
    return query select false, 'Insufficient MMC';
    return;
  end if;

  update public.rps_games
    set bet_amount = v_bet,
        next_bet_amount = null,
        next_bet_proposer_id = null
  where id = p_game_id;

  return query select true, null;
exception when others then
  return query select false, sqlerrm;
end;
$$;

grant execute on function public.accept_new_bet(uuid) to authenticated;

-- ============================================================
-- INTERNAL: resolve_rps_game (sets winner + applies payout correctly)
-- Winner +bet, loser -bet, draw = 0. No commission.
-- ============================================================
create or replace function public.resolve_rps_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.rps_games%rowtype;
  v_winner uuid;
  v_loser uuid;
  v_bet numeric;
  v_reason text;
  winner_bal numeric;
  loser_bal numeric;
begin
  select * into g
  from public.rps_games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'Game not found';
  end if;

  -- only resolve once
  if g.status = 'finished' then
    return;
  end if;

  -- need both moves
  if g.host_move is null or g.guest_move is null then
    return;
  end if;

  if g.bet_amount is null or g.bet_amount <= 0 then
    raise exception 'Bet not set';
  end if;

  v_bet := g.bet_amount;
  v_reason := format('rps_round_%s_payout', g.round_number);

  -- draw
  if g.host_move = g.guest_move then
    update public.rps_games
      set status = 'finished',
          winner_id = null
    where id = p_game_id;
    return;
  end if;

  -- compute winner
  v_winner :=
    case
      when (g.host_move = 'rock' and g.guest_move = 'scissors')
        or (g.host_move = 'paper' and g.guest_move = 'rock')
        or (g.host_move = 'scissors' and g.guest_move = 'paper')
        then g.host_id
      else g.guest_id
    end;

  v_loser := case when v_winner = g.host_id then g.guest_id else g.host_id end;

  -- Apply payout (transfer net)
  update public.profiles
    set mmc_balance = coalesce(mmc_balance, 0) + v_bet
  where id = v_winner
  returning mmc_balance into winner_bal;

  update public.profiles
    set mmc_balance = coalesce(mmc_balance, 0) - v_bet
  where id = v_loser
  returning mmc_balance into loser_bal;

  -- Ledger entries (2 rows)
  insert into public.mmc_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, created_at)
  values
    (v_winner, v_bet,  winner_bal, v_reason, 'rps_game', p_game_id, now()),
    (v_loser,  -v_bet, loser_bal,  v_reason, 'rps_game', p_game_id, now());

  -- Finish game
  update public.rps_games
    set status = 'finished',
        winner_id = v_winner
  where id = p_game_id;
end;
$$;

grant execute on function public.resolve_rps_game(uuid) to authenticated;

-- ============================================================
-- RPC: submit_rps_move
-- ============================================================
create or replace function public.submit_rps_move(p_game_id uuid, p_move text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  g public.rps_games%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_move not in ('rock','paper','scissors') then
    raise exception 'Invalid move';
  end if;

  select * into g
  from public.rps_games
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

  if not (g.host_id = v_user_id or g.guest_id = v_user_id) then
    raise exception 'Not a participant';
  end if;

  if v_user_id = g.host_id then
    if g.host_move is not null then
      raise exception 'Move already submitted';
    end if;

    update public.rps_games
      set host_move = p_move,
          status = case when g.guest_move is null then 'playing' else status end
    where id = p_game_id;
  else
    if g.guest_move is not null then
      raise exception 'Move already submitted';
    end if;

    update public.rps_games
      set guest_move = p_move,
          status = case when g.host_move is null then 'playing' else status end
    where id = p_game_id;
  end if;

  -- Reload and resolve if both moves present
  select * into g from public.rps_games where id = p_game_id for update;

  if g.host_move is not null and g.guest_move is not null then
    perform public.resolve_rps_game(p_game_id);
  end if;
end;
$$;

grant execute on function public.submit_rps_move(uuid, text) to authenticated;

-- ============================================================
-- RPC: restart_rps_game (new round, requires new bet each time)
-- ============================================================
create or replace function public.restart_rps_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  g public.rps_games%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into g
  from public.rps_games
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

  -- new round: clear moves + winner + bet + proposals
  update public.rps_games
    set status = 'active',
        host_move = null,
        guest_move = null,
        winner_id = null,
        bet_amount = null,
        next_bet_amount = null,
        next_bet_proposer_id = null,
        round_number = round_number + 1,
        expires_at = now() + interval '1 hour'
  where id = p_game_id;
end;
$$;

grant execute on function public.restart_rps_game(uuid) to authenticated;

commit;