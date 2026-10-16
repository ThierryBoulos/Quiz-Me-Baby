-- Wave 1: nothing breaks on the night (the database half, part 1 of 2).
-- Applied 2026-10-16. Part 2 (20261016b) lifts the 16-player cap and moves
-- the clean-up to a nightly job.
--
-- 1. Everyone can join at once (1A). Joins into one room queue up behind a
--    per-room lock, so twelve phones tapping "Take my seat" in the same
--    second all get in. A face somebody already has is no longer an error:
--    the phone quietly gets the next free one, and qmb_join says which face
--    it ended up with. (Once all 16 faces are used it hands out the asked-for
--    face again; part 2 drops the index that still refuses that.)
-- 2. Old QR codes (1C). A new phone scanning a finished game is told so
--    ('game_over') instead of landing in a dead room. qmb_room_state lets the
--    join page check a code before anyone types a name.
-- 3. Names lose invisible characters (zero-width spaces, direction marks), so
--    "Rami" and "Rami\u200b" can't both sit in one room.

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

create or replace function public.qmb_join(r text, nm text, face text) returns jsonb
  language plpgsql security definer set search_path = '' as
$$
declare me uuid := (select auth.uid()); clean text := trim(regexp_replace(coalesce(nm, ''), '[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]', '', 'g')); n int := 2; alt text; st text; got text;
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
       where room = r and user_id = me;
    exception when unique_violation then null;   -- keep the old name rather than fail a rejoin
    end;
    select avatar into got from public.members where room = r and user_id = me;
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

revoke execute on function public.qmb_join(text, text, text) from anon, public;
grant  execute on function public.qmb_join(text, text, text) to authenticated;
revoke execute on function public.qmb_room_state(text) from public;
grant  execute on function public.qmb_room_state(text) to anon, authenticated;
revoke execute on function private.qmb_faces(), private.qmb_pick_face(text, text, uuid) from public, anon, authenticated;
