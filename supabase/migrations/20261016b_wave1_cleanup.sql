-- Wave 1, part 2 of 2: the database half of "more than 16 players" (1A) and
-- the nightly clean-up (1D). Run in the Supabase SQL editor: the connector
-- holds DROP/DELETE statements for an approval that times out.
--
-- 1. Faces repeat once all 16 are used, so a 17th player can join: the
--    one-face-per-player index goes. qmb_join (part 1) already hands out free
--    faces first, one join at a time per room.
-- 2. "Create game" no longer pays for deleting yesterday's rooms; a nightly
--    job does it at 04:17 UTC, and also deletes anonymous logins unused for 30
--    days that aren't sitting in a room.

drop index if exists public.members_avatar_unique;

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
declare n_rooms int; n_users int;
begin
  delete from public.rooms where created_at < now() - interval '1 day';
  get diagnostics n_rooms = row_count;
  delete from auth.users u
   where u.is_anonymous and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '30 days'
     and not exists (select 1 from public.members m where m.user_id = u.id)
     and not exists (select 1 from public.rooms ro where ro.tv_id = u.id);
  get diagnostics n_users = row_count;
  return jsonb_build_object('rooms', n_rooms, 'users', n_users);
end
$$;
revoke execute on function private.qmb_cleanup() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'qmb-nightly-cleanup';
select cron.schedule('qmb-nightly-cleanup', '17 4 * * *', 'select private.qmb_cleanup()');
