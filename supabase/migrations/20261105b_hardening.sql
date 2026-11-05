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
