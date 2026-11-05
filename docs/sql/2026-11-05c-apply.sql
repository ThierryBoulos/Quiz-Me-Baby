-- Paste this whole file into Supabase > SQL editor and run it once (5 Nov, the final check). It only replaces
-- two functions and one size rule; it deletes nothing.
begin;
-- 5 Nov, the final check (a review of the day's changes). Fixes to the two migrations applied earlier today:
--
--   1. A phone taking over a game with no TV in the lobby got no save at all, so it read every tap the room ever had,
--      an old night's Start included (the night could start by itself). It now gets where the taps had got to.
--   2. A creator who tapped "Play without TV" and hadn't sat down yet could lose the game to a captain within
--      seconds. A room under 45 s old is never taken from a game phone that hasn't beaten yet.
--   3. Start with a host's own questions is bigger than 8 KB (every saved question goes with it): Start may carry
--      up to 300 KB; every other tap keeps the 8 KB limit.
--   4. Taking over as the TV from a laptop says how old the copy is, so its clocks move on by the right amount.

-- 1, 2
create or replace function public.qmb_take_game(r text) returns jsonb
  language plpgsql security definer set search_path = '' as
$$
declare me uuid := (select auth.uid()); rm public.rooms%rowtype; b private.ref_beat%rowtype; sv jsonb;
        wait interval;
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
  wait := case when rm.status = 'lobby' or coalesce(b.away, false) then interval '45 seconds' else interval '20 seconds' end;
  -- a game phone that never beat: left alone while the room is under 45 s old (its owner may still be on the way to
  -- a seat), takeable after that
  if b.room is null then
    if rm.created_at > now() - interval '45 seconds' then return jsonb_build_object('ok', true, 'taken', false); end if;
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
  -- no game to carry on: where the taps had got to, so the new phone doesn't read the room's taps from the first
  if sv is null then
    sv := jsonb_build_object('inboxLast', (select coalesce(max(id), 0) from public.actions where room = r));
  end if;
  return jsonb_build_object('ok', true, 'taken', true, 'save', sv, 'status', rm.status,
    'saved_ago', (select extract(epoch from now() - saved_at) from private.tv_backup where room = r));
end
$$;

revoke execute on function public.qmb_take_game(text) from anon, public;
grant  execute on function public.qmb_take_game(text) to authenticated;

-- 3
alter table public.actions drop constraint if exists actions_payload_size;
alter table public.actions add constraint actions_payload_size
  check (pg_column_size(payload) <= case when kind = 'setup' then 307200 else 8192 end) not valid;

-- 4
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
  return jsonb_build_object('ok', true, 'room', b.room, 'save', b.save,
    'saved_ago', extract(epoch from now() - b.saved_at));
end
$$;

revoke execute on function public.qmb_take_tv(text, text) from anon, public;
grant  execute on function public.qmb_take_tv(text, text) to authenticated;
commit;
