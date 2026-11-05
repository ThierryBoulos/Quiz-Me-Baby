-- Quiz Me Baby: paste all of this into Supabase → SQL Editor → New query → Run (5 Nov 2026).
-- Two changes: the no-TV takeover (20261105_takeover_wait) and the hardening (20261105b_hardening). Safe with the live app; deletes no data.
begin;

-- 5 Nov (the owner's picks on the 4 Nov audit: decision 2, items 1.1, 1.4, 1.6, 1.7). A game with no TV hands
-- itself over less eagerly, and never gets stuck:
--   * 45 s before another phone takes the game over in the lobby, or when the game phone said it was going to
--     sleep (another app, the screen locked); 20 s only when it stopped without a word.
--   * Two looks, not one: the game is taken only if it's still quiet a few seconds after a phone first saw it
--     quiet, so one slow heartbeat (the server busy for a moment) doesn't hand the game over (1.7).
--   * A game phone that never sent a heartbeat (the creator tapped "Play without TV" and never sat down) can be
--     replaced (1.1).
--   * In the lobby there's no game to carry on: the last night's save is dropped, not handed over (1.6).
--   * The game phone's seat can't be taken from the join screen ("take my seat back") while it runs the game (1.4).

alter table private.ref_beat add column if not exists away boolean not null default false;
alter table private.ref_beat add column if not exists stale_at timestamptz;

drop function if exists public.qmb_ref_beat(text);
create or replace function public.qmb_ref_beat(r text, away boolean default false) returns void
  language plpgsql security definer set search_path = '' as
$$
begin
  if not private.qmb_is_tv(r) then return; end if;
  insert into private.ref_beat (room, at, away, stale_at) values (r, now(), coalesce(away, false), null)
  on conflict (room) do update set at = now(), away = coalesce(excluded.away, false), stale_at = null;
end
$$;

create or replace function public.qmb_take_game(r text) returns jsonb
  language plpgsql security definer set search_path = '' as
$$
declare me uuid := (select auth.uid()); rm public.rooms%rowtype; b private.ref_beat%rowtype; sv jsonb;
        wait interval; seated boolean;
begin
  if me is null then return jsonb_build_object('error', 'not_signed_in'); end if;
  select * into rm from public.rooms where code = r for update;
  if not found then return jsonb_build_object('error', 'no_room'); end if;
  if coalesce((rm.state->>'notv')::boolean, false) is not true then return jsonb_build_object('error', 'has_tv'); end if;
  if rm.status = 'done' then return jsonb_build_object('error', 'over'); end if;
  if rm.tv_id = me then return jsonb_build_object('ok', true, 'taken', false); end if;
  if not exists (select 1 from public.members where room = r and user_id = me and role in ('host', 'captain')) then
    return jsonb_build_object('error', 'not_allowed'); end if;
  select * into b from private.ref_beat where room = r;
  seated := exists (select 1 from public.members where room = r and user_id = rm.tv_id);
  wait := case when rm.status = 'lobby' or coalesce(b.away, false) then interval '45 seconds' else interval '20 seconds' end;
  -- a game phone that never beat: fine while its owner is still on the way to a seat (the lobby's 45 s from
  -- when the room was made), takeable once that's past or once it has left the room
  if b.room is null then
    if seated and rm.created_at > now() - interval '45 seconds' then return jsonb_build_object('ok', true, 'taken', false); end if;
    insert into private.ref_beat (room, at, stale_at) values (r, now() - interval '1 hour', null);
    select * into b from private.ref_beat where room = r;
  end if;
  if b.at > now() - wait then return jsonb_build_object('ok', true, 'taken', false); end if;
  -- the first look at a quiet game phone only notes it; a look 4 s or more later takes the game
  if b.stale_at is null then
    update private.ref_beat set stale_at = now() where room = r;
    return jsonb_build_object('ok', true, 'taken', false, 'quiet', true);
  end if;
  if b.stale_at > now() - interval '4 seconds' then return jsonb_build_object('ok', true, 'taken', false, 'quiet', true); end if;
  update public.rooms set tv_id = me where code = r;
  insert into private.ref_beat (room, at, away, stale_at) values (r, now(), false, null)
  on conflict (room) do update set at = now(), away = false, stale_at = null;
  if rm.status = 'lobby' then
    delete from private.tv_backup where room = r;
    sv := null;
  else
    select save into sv from private.tv_backup where room = r;
  end if;
  return jsonb_build_object('ok', true, 'taken', true, 'save', sv, 'status', rm.status,
    'saved_ago', (select extract(epoch from now() - saved_at) from private.tv_backup where room = r));
end
$$;

revoke execute on function public.qmb_ref_beat(text, boolean), public.qmb_take_game(text) from anon, public;
grant  execute on function public.qmb_ref_beat(text, boolean), public.qmb_take_game(text) to authenticated;

-- "take my seat back" can't take the seat of the phone running a no-TV game: that phone is there
create or replace function public.qmb_rejoin(r text, nm text) returns jsonb
  language plpgsql security definer set search_path = '' as
$$
declare me uuid := (select auth.uid()); old uuid; oldrole text; rm public.rooms%rowtype;
begin
  if me is null then return jsonb_build_object('error', 'not_signed_in'); end if;
  select * into rm from public.rooms where code = r;
  if not found then return jsonb_build_object('error', 'no_room'); end if;
  if exists (select 1 from public.members where room = r and user_id = me) then return jsonb_build_object('ok', true); end if;
  select user_id, role into old, oldrole from public.members where room = r and lower(name) = lower(trim(nm));
  if old is null then return jsonb_build_object('error', 'no_such_player'); end if;
  if old = rm.tv_id and coalesce((rm.state->>'notv')::boolean, false)
     and exists (select 1 from private.ref_beat where room = r and at > now() - interval '45 seconds') then
    return jsonb_build_object('error', 'seat_in_use');
  end if;
  if oldrole in ('host', 'captain')
     and exists (select 1 from private.seen where room = r and user_id = old and seen_at > now() - interval '90 seconds') then
    return jsonb_build_object('error', 'seat_in_use');
  end if;
  update public.members set user_id = me where room = r and user_id = old;
  delete from private.seen where room = r and user_id = old;
  return jsonb_build_object('ok', true, 'rejoined', true);
end
$$;

-- 5 Nov (the owner's picks on the 4 Nov audit: 1.9 and 4.4). Small locks, and a host for a 3-8 team night that lost one.
--
--   1. A captain's suggestion list can't be broken by one bad row: the team in a suggestion is compared as it is,
--      not turned into a number first (a row with team "x" made every captain's list fail for the night).
--   2. A tap carries at most 8 KB, and one phone can't send more than 40 taps in 4 seconds (a flood).
--   3. The TV take-over code stops working after 5 wrong tries.
--   4. 3-8 teams: "I'm the host" works mid-game when the room has no host (only the host moves that night on, so
--      a host who left stopped the night for good). With a host there, it's refused as before.

-- 1
drop policy if exists actions_read on public.actions;
create policy actions_read on public.actions for select to authenticated using (
  private.qmb_is_tv(room) or private.qmb_role(room) = 'host' or user_id = (select auth.uid())
  or (kind = 'suggest' and private.qmb_role(room) = 'captain' and (payload -> 'team') = to_jsonb(private.qmb_team(room)))
);

-- 2
alter table public.actions drop constraint if exists actions_payload_size;
alter table public.actions add constraint actions_payload_size check (pg_column_size(payload) <= 8192) not valid;

create or replace function private.qmb_tap_limit() returns trigger
  language plpgsql security definer set search_path = '' as
$$
begin
  if (select count(*) from public.actions
      where room = new.room and user_id = new.user_id and at > now() - interval '4 seconds') >= 40 then
    raise exception 'too many taps' using errcode = 'P0001';
  end if;
  return new;
end
$$;
drop trigger if exists actions_tap_limit on public.actions;
create trigger actions_tap_limit before insert on public.actions for each row execute function private.qmb_tap_limit();

-- 3
alter table private.tv_backup add column if not exists tries smallint not null default 0;

create or replace function public.qmb_tv_code(r text) returns jsonb
  language plpgsql security definer set search_path = '' as
$$
declare c text;
begin
  if not exists (select 1 from public.members where room = r and user_id = (select auth.uid()) and role = 'host') then
    return jsonb_build_object('error', 'not_host'); end if;
  if not exists (select 1 from private.tv_backup where room = r) then return jsonb_build_object('error', 'no_backup'); end if;
  c := lpad((floor(random() * 1000000))::int::text, 6, '0');
  update private.tv_backup set code = c, code_until = now() + interval '10 minutes', tries = 0 where room = r;
  return jsonb_build_object('ok', true, 'code', c,
    'saved', (select extract(epoch from now() - saved_at)::int from private.tv_backup where room = r));
end
$$;

create or replace function public.qmb_take_tv(r text, c text) returns jsonb
  language plpgsql security definer set search_path = '' as
$$
declare me uuid := (select auth.uid()); b private.tv_backup%rowtype;
begin
  if me is null then return jsonb_build_object('error', 'not_signed_in'); end if;
  select * into b from private.tv_backup where room = upper(trim(r)) for update;
  if not found or b.code is null or b.code_until < now() then return jsonb_build_object('error', 'bad_code'); end if;
  if b.code <> trim(c) then
    -- five wrong tries and the code is gone: the host gets a new one
    update private.tv_backup set tries = tries + 1,
      code = case when tries + 1 >= 5 then null else code end,
      code_until = case when tries + 1 >= 5 then null else code_until end
    where room = b.room;
    return jsonb_build_object('error', 'bad_code');
  end if;
  update public.rooms set tv_id = me where code = b.room;
  update private.tv_backup set code = null, code_until = null, tries = 0 where room = b.room;
  return jsonb_build_object('ok', true, 'room', b.room, 'save', b.save);
end
$$;

-- 4
create or replace function public.qmb_claim(r text, want text) returns text
  language plpgsql security definer set search_path = '' as
$$
declare me public.members%rowtype; taken text; rm public.rooms%rowtype;
begin
  select * into me from public.members where room = r and user_id = (select auth.uid());
  if not found then return 'not in this room'; end if;
  if want = 'captain' then
    if me.team is null then return 'pick a team first'; end if;
    select name into taken from public.members where room = r and team = me.team and role = 'captain' and user_id <> me.user_id;
    if taken is not null then return taken || ' is your captain'; end if;
    update public.members set role = 'captain' where room = r and user_id = me.user_id;
  elsif want = 'host' then
    select * into rm from public.rooms where code = r;
    select name into taken from public.members where room = r and role = 'host' and user_id <> me.user_id;
    if taken is not null then return taken || ' is the host'; end if;
    -- mid-game only for 3-8 teams (a two-team night with no host goes on without one)
    if rm.status <> 'lobby' and coalesce(rm.mode, '') <> 'many' then return 'the game has started'; end if;
    update public.members set role = 'host', team = null where room = r and user_id = me.user_id;
  elsif want = 'player' then
    update public.members set role = 'player' where room = r and user_id = me.user_id;
  else
    return 'unknown role';
  end if;
  return 'ok';
end
$$;

commit;
