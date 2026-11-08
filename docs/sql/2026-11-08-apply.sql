-- Paste this whole file into Supabase > SQL editor and run it once (8 Nov). It only replaces one function
-- ("I'm the host"); it deletes nothing.
begin;
-- 8 Nov: a host who has gone quiet can be replaced (the owner: "allow a player to take over as host if there's no
-- host ... can someone join as a host with a different name after 90 s?").
--
-- Until now "I'm the host" mid-game worked only with 3-8 teams, and only when the room had no host at all: a host
-- whose phone died still held the role, so nobody could take over and a 3-8 night stood still. Now, once the game
-- has started (3-8 teams, or two teams in a night that started with a host):
--   - a host whose phone the TV hasn't seen for 90 s (the same wait as taking a seat back) can be replaced by anyone
--     in the room, a player or a captain, under their own name; the old host becomes a player (no team);
--   - a host still here keeps the role, as before ("<name> is the host");
--   - a two-team night that started without a host still goes on without one ("the game has started").
-- Nothing else changes; nothing is deleted but the old host's "last seen" note.
create or replace function public.qmb_claim(r text, want text) returns text
  language plpgsql security definer set search_path = '' as
$$
declare me public.members%rowtype; taken public.members%rowtype; tname text; rm public.rooms%rowtype;
begin
  select * into me from public.members where room = r and user_id = (select auth.uid());
  if not found then return 'not in this room'; end if;
  if want = 'captain' then
    if me.team is null then return 'pick a team first'; end if;
    select name into tname from public.members where room = r and team = me.team and role = 'captain' and user_id <> me.user_id;
    if tname is not null then return tname || ' is your captain'; end if;
    update public.members set role = 'captain' where room = r and user_id = me.user_id;
  elsif want = 'host' then
    select * into rm from public.rooms where code = r;
    -- mid-game: 3-8 teams, or two teams in a night that started with a host
    if rm.status <> 'lobby' and coalesce(rm.mode, '') not in ('many', 'host') then return 'the game has started'; end if;
    select * into taken from public.members where room = r and role = 'host' and user_id <> me.user_id;
    if found then
      -- in the lobby, or mid-game with the host's phone still here (seen in the last 90 s): the role stays theirs
      if rm.status = 'lobby'
         or exists (select 1 from private.seen where room = r and user_id = taken.user_id and seen_at > now() - interval '90 seconds') then
        return taken.name || ' is the host';
      end if;
      update public.members set role = 'player', team = null where room = r and user_id = taken.user_id;
      delete from private.seen where room = r and user_id = taken.user_id;
    end if;
    update public.members set role = 'host', team = null where room = r and user_id = me.user_id;
  elsif want = 'player' then
    update public.members set role = 'player' where room = r and user_id = me.user_id;
  else
    return 'unknown role';
  end if;
  return 'ok';
end
$$;

revoke execute on function public.qmb_claim(text, text) from anon, public;
grant  execute on function public.qmb_claim(text, text) to authenticated;
commit;
