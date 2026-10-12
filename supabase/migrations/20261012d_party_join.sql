-- Joining by code, SNAKED-style: one call that says exactly what went wrong.
-- Security definer so a phone that isn't in the room yet can still look at
-- which names and faces are taken, without being able to read the line-up.
create or replace function public.qmb_join(r text, nm text, face text) returns jsonb
  language plpgsql security definer set search_path = '' as
$$
declare me uuid := (select auth.uid()); clean text := trim(nm); n int := 2; alt text;
begin
  if me is null then return jsonb_build_object('error', 'not_signed_in'); end if;
  if not exists (select 1 from public.rooms where code = r) then return jsonb_build_object('error', 'no_room'); end if;
  /* the same phone coming back: same seat, new name/face if it changed them */
  if exists (select 1 from public.members where room = r and user_id = me) then
    begin
      update public.members set name = coalesce(nullif(clean, ''), name), avatar = coalesce(face, avatar)
       where room = r and user_id = me;
    exception when unique_violation then null;   -- keep the old name/face rather than fail a rejoin
    end;
    return jsonb_build_object('ok', true, 'rejoined', true);
  end if;
  if clean = '' or char_length(clean) > 12 then return jsonb_build_object('error', 'bad_name'); end if;
  if exists (select 1 from public.members where room = r and lower(name) = lower(clean)) then
    loop
      alt := left(clean, 10) || ' ' || n;
      exit when not exists (select 1 from public.members where room = r and lower(name) = lower(alt));
      n := n + 1;
    end loop;
    return jsonb_build_object('error', 'name_taken', 'suggestion', alt);
  end if;
  if face is not null and exists (select 1 from public.members where room = r and avatar = face) then
    return jsonb_build_object('error', 'face_taken');
  end if;
  insert into public.members (room, user_id, name, avatar) values (r, me, clean, face);
  return jsonb_build_object('ok', true);
end
$$;

create or replace function public.qmb_taken_faces(r text) returns text[]
  language sql stable security definer set search_path = '' as
$$ select coalesce(array_agg(avatar), '{}') from public.members where room = r and avatar is not null $$;

revoke execute on function public.qmb_join(text, text, text), public.qmb_taken_faces(text) from anon, public;
grant  execute on function public.qmb_join(text, text, text), public.qmb_taken_faces(text) to authenticated;

-- Old rooms tidy themselves away: anything over a day old is deleted (and its
-- members, answers and actions with it) whenever a new room is made.
create or replace function public.qmb_create_room() returns text
  language plpgsql security definer set search_path = '' as
$$
declare c text; letters text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  delete from public.rooms where created_at < now() - interval '1 day';
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
