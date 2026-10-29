-- 29 Oct: a seat can't be taken from a phone that's still there.
--
-- Until now anyone with the room code could open the join screen, type the host's name (it's on the TV),
-- tap "take my seat back", and be the host: see every answer, and the real host's phone was sent to the
-- join screen. The same went for a captain's seat, and "I'm the host" could be taken mid-game in a no-host
-- night. Now:
--   1. The TV keeps a note of when it last saw each host and captain (private.seen, written through
--      qmb_seen every 30 s from the presence channel). It's private: no phone reads it.
--   2. qmb_rejoin hands over a host's or a captain's seat only when that phone hasn't been seen for 90 s,
--      which is exactly the case it's for: a phone that died, and its owner on a new one. A seat still in
--      use answers 'seat_in_use'. Players' seats rejoin as before (nothing secret behind them).
--   3. "I'm the host" (qmb_claim) only works in the lobby.

create table if not exists private.seen (
  room     text not null references public.rooms(code) on delete cascade,
  user_id  uuid not null,
  seen_at  timestamptz not null default now(),
  primary key (room, user_id)
);

/* the TV: these phones are here right now */
create or replace function public.qmb_seen(r text, ids uuid[]) returns void
  language plpgsql security definer set search_path = '' as
$$
begin
  if not private.qmb_is_tv(r) then return; end if;
  insert into private.seen (room, user_id, seen_at)
    select r, u, now() from unnest(ids) as u
  on conflict (room, user_id) do update set seen_at = now();
end
$$;
revoke execute on function public.qmb_seen(text, uuid[]) from anon, public;
grant  execute on function public.qmb_seen(text, uuid[]) to authenticated;

create or replace function public.qmb_rejoin(r text, nm text) returns jsonb
  language plpgsql security definer set search_path = '' as
$$
declare me uuid := (select auth.uid()); old uuid; oldrole text;
begin
  if me is null then return jsonb_build_object('error', 'not_signed_in'); end if;
  if not exists (select 1 from public.rooms where code = r) then return jsonb_build_object('error', 'no_room'); end if;
  if exists (select 1 from public.members where room = r and user_id = me) then return jsonb_build_object('ok', true); end if;
  select user_id, role into old, oldrole from public.members where room = r and lower(name) = lower(trim(nm));
  if old is null then return jsonb_build_object('error', 'no_such_player'); end if;
  if oldrole in ('host', 'captain')
     and exists (select 1 from private.seen where room = r and user_id = old and seen_at > now() - interval '90 seconds') then
    return jsonb_build_object('error', 'seat_in_use');
  end if;
  update public.members set user_id = me where room = r and user_id = old;
  delete from private.seen where room = r and user_id = old;
  return jsonb_build_object('ok', true, 'rejoined', true);
end
$$;

create or replace function public.qmb_claim(r text, want text) returns text
  language plpgsql security definer set search_path = '' as
$$
declare me public.members%rowtype; taken text;
begin
  select * into me from public.members where room = r and user_id = (select auth.uid());
  if not found then return 'not in this room'; end if;
  if want = 'captain' then
    if me.team is null then return 'pick a team first'; end if;
    select name into taken from public.members where room = r and team = me.team and role = 'captain' and user_id <> me.user_id;
    if taken is not null then return taken || ' is your captain'; end if;
    update public.members set role = 'captain' where room = r and user_id = me.user_id;
  elsif want = 'host' then
    if (select status from public.rooms where code = r) <> 'lobby' then return 'the game has started'; end if;
    select name into taken from public.members where room = r and role = 'host' and user_id <> me.user_id;
    if taken is not null then return taken || ' is the host'; end if;
    update public.members set role = 'host', team = null where room = r and user_id = me.user_id;
  elsif want = 'player' then
    update public.members set role = 'player' where room = r and user_id = me.user_id;
  else
    return 'unknown role';
  end if;
  return 'ok';
end
$$;
