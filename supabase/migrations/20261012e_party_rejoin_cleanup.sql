-- Step 5: getting back in, and tidying up.
--
-- 1. Rejoining mid-game. A phone that dies (or a player who switches phone)
--    joins again with the same name and takes their old seat back: same team,
--    same role (a captain stays captain). Only once the game has started — in
--    the lobby a repeated name still gets a "Rami 2?" suggestion.
-- 2. qmb_join says whether the room is already playing, so the join screen
--    can offer "take my seat back" for a taken name.
-- 3. Old rooms tidy themselves away: anything over a day old is deleted (with
--    its members, answers and actions) whenever a new room is made. Codes keep
--    SNAKED's alphabet from 20261012c (2-9 and letters, no I, L or O). The
--    first try at this cleanup, in 20261012d, timed out and never applied.

create or replace function public.qmb_rejoin(r text, nm text) returns jsonb
  language plpgsql security definer set search_path = '' as
$$
declare me uuid := (select auth.uid()); old uuid;
begin
  if me is null then return jsonb_build_object('error', 'not_signed_in'); end if;
  if not exists (select 1 from public.rooms where code = r) then return jsonb_build_object('error', 'no_room'); end if;
  if exists (select 1 from public.members where room = r and user_id = me) then return jsonb_build_object('ok', true); end if;
  if (select status from public.rooms where code = r) = 'lobby' then return jsonb_build_object('error', 'not_started'); end if;
  select user_id into old from public.members where room = r and lower(name) = lower(trim(nm));
  if old is null then return jsonb_build_object('error', 'no_such_player'); end if;
  update public.members set user_id = me where room = r and user_id = old;
  return jsonb_build_object('ok', true, 'rejoined', true);
end
$$;
revoke execute on function public.qmb_rejoin(text, text) from anon, public;
grant  execute on function public.qmb_rejoin(text, text) to authenticated;

create or replace function public.qmb_join(r text, nm text, face text) returns jsonb
  language plpgsql security definer set search_path = '' as
$$
declare me uuid := (select auth.uid()); clean text := trim(nm); n int := 2; alt text; st text;
begin
  if me is null then return jsonb_build_object('error', 'not_signed_in'); end if;
  select status into st from public.rooms where code = r;
  if st is null then return jsonb_build_object('error', 'no_room'); end if;
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
    return jsonb_build_object('error', 'name_taken', 'suggestion', alt, 'playing', st <> 'lobby');
  end if;
  if face is not null and exists (select 1 from public.members where room = r and avatar = face) then
    return jsonb_build_object('error', 'face_taken');
  end if;
  insert into public.members (room, user_id, name, avatar) values (r, me, clean, face);
  return jsonb_build_object('ok', true);
end
$$;

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
