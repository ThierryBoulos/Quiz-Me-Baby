-- Quiz Me Baby v4 — Party mode rooms.
-- Everyone signs in anonymously (no accounts); a phone's anonymous user id is
-- its identity in a room. The TV runs the game and is the only writer of the
-- game state; phones send actions. Answers live in `secrets`, readable only
-- by the room's TV and its host — enforced here, not by hiding them in a page.

-- ---------------------------------------------------------------- tables
create table public.rooms (
  code        text primary key check (code ~ '^[A-Z]{4}$'),
  tv_id       uuid not null default auth.uid(),          -- the device running the game
  status      text not null default 'lobby' check (status in ('lobby','playing','done')),
  mode        text check (mode in ('classic','host','nohost')),
  state       jsonb not null default '{}'::jsonb,       -- public game state, written by the TV
  version     integer not null default 0,
  created_at  timestamptz not null default now()
);

create table public.members (
  room       text not null references public.rooms(code) on delete cascade,
  user_id    uuid not null default auth.uid(),
  name       text not null check (char_length(name) between 1 and 24),
  team       smallint check (team in (0, 1)),
  role       text not null default 'player' check (role in ('player','captain','host')),
  joined_at  timestamptz not null default now(),
  primary key (room, user_id),
  check (role <> 'host' or team is null),
  check (role <> 'captain' or team is not null)
);
-- one captain per team, one host per room
create unique index members_one_captain on public.members (room, team) where role = 'captain';
create unique index members_one_host    on public.members (room)       where role = 'host';

create table public.secrets (
  room   text primary key references public.rooms(code) on delete cascade,
  data   jsonb not null default '{}'::jsonb              -- the current answers, written by the TV
);

-- phones -> TV: buzzes, answers, suggestions, team names. The server clock
-- (`at`) decides who buzzed first.
create table public.actions (
  id       bigint generated always as identity primary key,
  room     text not null references public.rooms(code) on delete cascade,
  user_id  uuid not null default auth.uid(),
  kind     text not null check (kind in ('buzz','answer','suggest','bid','count','judge','next','setup','team_name','lifeline')),
  payload  jsonb not null default '{}'::jsonb,
  at       timestamptz not null default now()
);
create index actions_room_at on public.actions (room, at);

-- ---------------------------------------------------------------- helpers
-- security definer so the policies below can ask about membership without
-- recursing into members' own policies.
create function public.qmb_is_tv(r text) returns boolean
  language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.rooms where code = r and tv_id = (select auth.uid())) $$;

create function public.qmb_role(r text) returns text
  language sql stable security definer set search_path = '' as
$$ select role from public.members where room = r and user_id = (select auth.uid()) $$;

create function public.qmb_team(r text) returns smallint
  language sql stable security definer set search_path = '' as
$$ select team from public.members where room = r and user_id = (select auth.uid()) $$;

create function public.qmb_in_room(r text) returns boolean
  language sql stable security definer set search_path = '' as
$$ select public.qmb_is_tv(r) or exists (select 1 from public.members where room = r and user_id = (select auth.uid())) $$;

-- ---------------------------------------------------------------- RLS
alter table public.rooms   enable row level security;
alter table public.members enable row level security;
alter table public.secrets enable row level security;
alter table public.actions enable row level security;

-- rooms: anyone signed in can look a code up (that is how joining works);
-- only the TV that made it can change it.
create policy rooms_read   on public.rooms for select to authenticated using (true);
create policy rooms_create on public.rooms for insert to authenticated with check (tv_id = (select auth.uid()));
create policy rooms_tv     on public.rooms for update to authenticated using (tv_id = (select auth.uid())) with check (tv_id = (select auth.uid()));
create policy rooms_end    on public.rooms for delete to authenticated using (tv_id = (select auth.uid()));

-- members: everyone in the room sees the line-up (names, teams, captains).
-- You add and edit yourself; the TV and the host can move people around.
create policy members_read on public.members for select to authenticated using (public.qmb_in_room(room));
create policy members_join on public.members for insert to authenticated
  with check (user_id = (select auth.uid()) and role = 'player');
-- Roles only change through qmb_claim, and your own name/team through
-- qmb_update_me, so a player cannot simply write role = 'host'. The TV and
-- the host may edit anyone directly (moving a player, swapping a captain).
create policy members_edit on public.members for update to authenticated
  using (public.qmb_is_tv(room) or public.qmb_role(room) = 'host')
  with check (public.qmb_is_tv(room) or public.qmb_role(room) = 'host');
create policy members_leave on public.members for delete to authenticated
  using (user_id = (select auth.uid()) or public.qmb_is_tv(room) or public.qmb_role(room) = 'host');

-- secrets: the TV writes; only the TV and the host can read.
create policy secrets_read  on public.secrets for select to authenticated
  using (public.qmb_is_tv(room) or public.qmb_role(room) = 'host');
create policy secrets_write on public.secrets for all to authenticated
  using (public.qmb_is_tv(room)) with check (public.qmb_is_tv(room));

-- actions: members send their own. The TV and the host read everything; a
-- captain also reads their own team's suggestions; you always see your own.
create policy actions_send on public.actions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.qmb_in_room(room));
create policy actions_read on public.actions for select to authenticated using (
  public.qmb_is_tv(room)
  or public.qmb_role(room) = 'host'
  or user_id = (select auth.uid())
  or (kind = 'suggest' and public.qmb_role(room) = 'captain'
      and (payload->>'team')::smallint = public.qmb_team(room))
);

-- ---------------------------------------------------------------- rpc
-- A fresh 4-letter code (no I or O — they read as 1 and 0 across a room).
create function public.qmb_create_room() returns text
  language plpgsql security definer set search_path = '' as
$$
declare c text; letters text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  loop
    c := '';
    for i in 1..4 loop c := c || substr(letters, 1 + floor(random() * length(letters))::int, 1); end loop;
    exit when not exists (select 1 from public.rooms where code = c);
  end loop;
  insert into public.rooms (code, tv_id) values (c, (select auth.uid()));
  insert into public.secrets (room) values (c);
  return c;
end
$$;

-- Captain and host are first-come; the unique indexes above make the race
-- safe. These return a plain reason instead of a constraint error.
create function public.qmb_claim(r text, want text) returns text
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

-- Your own name and team. Switching team drops captaincy.
create function public.qmb_update_me(r text, nm text, tm smallint) returns text
  language plpgsql security definer set search_path = '' as
$$
declare me public.members%rowtype;
begin
  select * into me from public.members where room = r and user_id = (select auth.uid());
  if not found then return 'not in this room'; end if;
  if me.role = 'host' and tm is not null then return 'the host has no team'; end if;
  update public.members
     set name = coalesce(nullif(trim(nm), ''), name),
         team = tm,
         role = case when me.role = 'captain' and tm is distinct from me.team then 'player' else role end
   where room = r and user_id = me.user_id;
  return 'ok';
end
$$;

revoke execute on function public.qmb_is_tv(text), public.qmb_role(text), public.qmb_team(text), public.qmb_in_room(text) from anon, public;
grant  execute on function public.qmb_is_tv(text), public.qmb_role(text), public.qmb_team(text), public.qmb_in_room(text) to authenticated;
revoke execute on function public.qmb_update_me(text, text, smallint) from anon, public;
grant  execute on function public.qmb_update_me(text, text, smallint) to authenticated;
revoke execute on function public.qmb_create_room() from anon, public;
revoke execute on function public.qmb_claim(text, text) from anon, public;
grant  execute on function public.qmb_create_room() to authenticated;
grant  execute on function public.qmb_claim(text, text) to authenticated;

-- ---------------------------------------------------------------- realtime
alter publication supabase_realtime add table public.rooms, public.members, public.secrets, public.actions;
