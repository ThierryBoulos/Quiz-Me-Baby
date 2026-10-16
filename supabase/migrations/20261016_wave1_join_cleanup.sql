-- Wave 1: nothing breaks on the night (the database half).
--
-- 1. Everyone can join at once (1A). Joins into one room queue up behind a
--    per-room lock, so twelve phones tapping "Take my seat" in the same
--    second all get in. A face somebody already has is no longer an error:
--    the phone quietly gets the next free one, and qmb_join says which face
--    it ended up with. Once all 16 faces are used, faces repeat, so a 17th
--    player can join (the one-face-per-player index goes).
-- 2. Old QR codes (1C). A new phone scanning a finished game is told so
--    ('game_over') instead of landing in a dead room. qmb_room_state lets the
--    join page check a code before anyone types a name.
-- 3. Ops basics (1D). qmb_health is the database half of /api/health. The
--    clean-up of day-old rooms moves out of "Create game" into a nightly job,
--    which also deletes anonymous logins nobody has used for a month.

-- the 16 faces, in the order of party/lib/faces.ts
create or replace function private.qmb_faces() returns text[]
  language sql immutable set search_path = '' as
$$ select array['🦊','🐼','🐸','🦁','🐙','🦄','🐯','🐨','🐵','🐧','🦉','🐝','🐳','🦖','🐷','🐻'] $$;

/* The face a phone gets: the one it asked for if it's free, else the next
   free one after it (wrapping round), else (all 16 used) the one it asked for. */
create or replace function private.qmb_pick_face(r text, want text, me uuid) returns text
  language plpgsql stable set search_path = '' as
$$
declare f text[] := private.qmb_faces(); n int := array_length(f, 1); start int; i int; c text;
begin
  start := coalesce(array_position(f, want), 1 + floor(random() * n)::int);
  for i in 0..n - 1 loop
    c := f[1 + (start - 1 + i) % n];
    if not exists (select 1 from public.members where room = r and avatar = c and user_id <> me) then return c; end if;
  end loop;
  return coalesce(want, f[start]);
end
$$;

drop index if exists public.members_avatar_unique;

create or replace function public.qmb_join(r text, nm text, face text) returns jsonb
  language plpgsql security definer set search_path = '' as
$$
declare me uuid := (select auth.uid()); clean text := trim(nm); n int := 2; alt text; st text; got text;
begin
  if me is null then return jsonb_build_object('error', 'not_signed_in'); end if;
  /* one join at a time per room: the face and name checks below can't race */
  perform pg_advisory_xact_lock(hashtext('qmb_join:' || r));
  select status into st from public.rooms where code = r;
  if st is null then return jsonb_build_object('error', 'no_room'); end if;
  /* the same phone coming back: same seat, new name/face if it changed them */
  if exists (select 1 from public.members where room = r and user_id = me) then
    begin
      update public.members set name = coalesce(nullif(clean, ''), name),
             avatar = case when face is null then avatar else private.qmb_pick_face(r, face, me) end
       where room = r and user_id = me
      returning avatar into got;
    exception when unique_violation then null;   -- keep the old name rather than fail a rejoin
    end;
    return jsonb_build_object('ok', true, 'rejoined', true, 'face', got);
  end if;
  if st = 'done' then return jsonb_build_object('error', 'game_over'); end if;
  if clean = '' or char_length(clean) > 12 then return jsonb_build_object('error', 'bad_name'); end if;
  if exists (select 1 from public.members where room = r and lower(name) = lower(clean)) then
    loop
      alt := left(clean, 10) || ' ' || n;
      exit when not exists (select 1 from public.members where room = r and lower(name) = lower(alt));
      n := n + 1;
    end loop;
    return jsonb_build_object('error', 'name_taken', 'suggestion', alt, 'playing', st <> 'lobby');
  end if;
  got := private.qmb_pick_face(r, face, me);
  insert into public.members (room, user_id, name, avatar) values (r, me, clean, got);
  return jsonb_build_object('ok', true, 'face', got);
end
$$;

/* Before typing a name: is this code a game you can join?
   'lobby' | 'playing' | 'done' | 'gone' (never existed, or tidied away). */
create or replace function public.qmb_room_state(r text) returns text
  language sql stable security definer set search_path = '' as
$$ select coalesce((select status from public.rooms where code = upper(trim(r))), 'gone') $$;

/* /api/health: the database is awake and answering. */
create or replace function public.qmb_health() returns jsonb
  language sql stable security definer set search_path = '' as
$$ select jsonb_build_object('ok', true, 'now', now(), 'rooms', (select count(*) from public.rooms)) $$;

revoke execute on function public.qmb_join(text, text, text) from anon, public;
grant  execute on function public.qmb_join(text, text, text) to authenticated;
revoke execute on function public.qmb_room_state(text), public.qmb_health() from public;
grant  execute on function public.qmb_room_state(text), public.qmb_health() to anon, authenticated;
revoke execute on function private.qmb_faces(), private.qmb_pick_face(text, text, uuid) from public, anon, authenticated;

-- "Create game" no longer pays for deleting yesterday's rooms.
create or replace function public.qmb_create_room() returns text
  language plpgsql security definer set search_path = '' as
$$
declare c text; letters text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
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

/* The nightly tidy-up: rooms over a day old (their members, answers and
   actions go with them), and anonymous logins unused for 30 days that
   aren't sitting in a room. */
create or replace function private.qmb_cleanup() returns jsonb
  language plpgsql security definer set search_path = '' as
$$
declare rooms int; users int;
begin
  delete from public.rooms where created_at < now() - interval '1 day';
  get diagnostics rooms = row_count;
  delete from auth.users u
   where u.is_anonymous and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '30 days'
     and not exists (select 1 from public.members m where m.user_id = u.id)
     and not exists (select 1 from public.rooms ro where ro.tv_id = u.id);
  get diagnostics users = row_count;
  return jsonb_build_object('rooms', rooms, 'users', users);
end
$$;
revoke execute on function private.qmb_cleanup() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'qmb-nightly-cleanup';
select cron.schedule('qmb-nightly-cleanup', '17 4 * * *', 'select private.qmb_cleanup()');
