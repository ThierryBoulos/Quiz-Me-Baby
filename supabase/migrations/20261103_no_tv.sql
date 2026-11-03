-- 3 Nov: a game with no TV. The creator taps "Play without TV" in the TV's lobby (room.state.notv) and takes a
-- seat; their phone runs the game (it stays the room's tv_id). If that phone goes quiet (asleep, another app,
-- battery), the host or a captain's phone takes the game over from its last save, as a new TV laptop does (B9).
--
-- ref_beat: the phone running the game says "still here" every 5 s while it's on screen.
-- qmb_take_game: the host or a captain, in a room with no TV, whose game phone hasn't been heard for 20 s,
-- becomes the room's game phone, and gets the last save. One at a time (the room row is locked).
create table if not exists private.ref_beat (
  room text primary key references public.rooms(code) on delete cascade,
  at   timestamptz not null default now()
);

create or replace function public.qmb_ref_beat(r text) returns void
  language plpgsql security definer set search_path = '' as
$$
begin
  if not private.qmb_is_tv(r) then return; end if;
  insert into private.ref_beat (room, at) values (r, now())
  on conflict (room) do update set at = now();
end
$$;

create or replace function public.qmb_take_game(r text) returns jsonb
  language plpgsql security definer set search_path = '' as
$$
declare me uuid := (select auth.uid()); rm public.rooms%rowtype; beat timestamptz; sv jsonb;
begin
  if me is null then return jsonb_build_object('error', 'not_signed_in'); end if;
  select * into rm from public.rooms where code = r for update;
  if not found then return jsonb_build_object('error', 'no_room'); end if;
  if coalesce((rm.state->>'notv')::boolean, false) is not true then return jsonb_build_object('error', 'has_tv'); end if;
  if rm.status = 'done' then return jsonb_build_object('error', 'over'); end if;
  if rm.tv_id = me then return jsonb_build_object('ok', true, 'taken', false); end if;
  if not exists (select 1 from public.members where room = r and user_id = me and role in ('host', 'captain')) then
    return jsonb_build_object('error', 'not_allowed'); end if;
  select at into beat from private.ref_beat where room = r;
  if beat is null or beat > now() - interval '20 seconds' then return jsonb_build_object('ok', true, 'taken', false); end if;
  update public.rooms set tv_id = me where code = r;
  insert into private.ref_beat (room, at) values (r, now()) on conflict (room) do update set at = now();
  select save into sv from private.tv_backup where room = r;
  return jsonb_build_object('ok', true, 'taken', true, 'save', sv);
end
$$;

revoke execute on function public.qmb_ref_beat(text), public.qmb_take_game(text) from anon, public;
grant  execute on function public.qmb_ref_beat(text), public.qmb_take_game(text) to authenticated;
