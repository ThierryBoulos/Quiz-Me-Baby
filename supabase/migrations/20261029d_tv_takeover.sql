-- 29 Oct: a dead TV laptop can be replaced (review B9).
-- The TV keeps one backup of the game here (one row per room, overwritten, gone with the room; ~30 KB).
-- The host's phone asks for a 6-digit code (10 minutes); a new laptop enters the room code and that code,
-- becomes the room's TV, and gets the backup to carry on from. Nobody but the host can start it, and only
-- the TV can write the backup. Nothing reads it but a takeover.
create table if not exists private.tv_backup (
  room     text primary key references public.rooms(code) on delete cascade,
  save     jsonb not null,
  saved_at timestamptz not null default now(),
  code     text,
  code_until timestamptz
);

/* the TV: here's the game as it stands */
create or replace function public.qmb_tv_backup(r text, s jsonb) returns void
  language plpgsql security definer set search_path = '' as
$$
begin
  if not private.qmb_is_tv(r) then return; end if;
  if pg_column_size(s) > 400000 then return; end if;
  insert into private.tv_backup (room, save, saved_at) values (r, s, now())
  on conflict (room) do update set save = excluded.save, saved_at = now();
end
$$;

/* the host: a code for the new laptop */
create or replace function public.qmb_tv_code(r text) returns jsonb
  language plpgsql security definer set search_path = '' as
$$
declare c text;
begin
  if not exists (select 1 from public.members where room = r and user_id = (select auth.uid()) and role = 'host') then
    return jsonb_build_object('error', 'not_host'); end if;
  if not exists (select 1 from private.tv_backup where room = r) then return jsonb_build_object('error', 'no_backup'); end if;
  c := lpad((floor(random() * 1000000))::int::text, 6, '0');
  update private.tv_backup set code = c, code_until = now() + interval '10 minutes' where room = r;
  return jsonb_build_object('ok', true, 'code', c,
    'saved', (select extract(epoch from now() - saved_at)::int from private.tv_backup where room = r));
end
$$;

/* the new laptop: the room code and the host's code make it the TV */
create or replace function public.qmb_take_tv(r text, c text) returns jsonb
  language plpgsql security definer set search_path = '' as
$$
declare me uuid := (select auth.uid()); b private.tv_backup%rowtype;
begin
  if me is null then return jsonb_build_object('error', 'not_signed_in'); end if;
  select * into b from private.tv_backup where room = upper(trim(r));
  if not found or b.code is null or b.code_until < now() or b.code <> trim(c) then return jsonb_build_object('error', 'bad_code'); end if;
  update public.rooms set tv_id = me where code = b.room;
  update private.tv_backup set code = null, code_until = null where room = b.room;
  return jsonb_build_object('ok', true, 'room', b.room, 'save', b.save);
end
$$;

revoke execute on function public.qmb_tv_backup(text, jsonb), public.qmb_tv_code(text), public.qmb_take_tv(text, text) from anon, public;
grant  execute on function public.qmb_tv_backup(text, jsonb), public.qmb_tv_code(text), public.qmb_take_tv(text, text) to authenticated;
