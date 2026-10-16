-- Wave 2, 2I: a phone that died in the lobby can take its seat back too (it
-- used to work only once the game had started). Same name, same seat: team,
-- captaincy and all.
create or replace function public.qmb_rejoin(r text, nm text) returns jsonb
  language plpgsql security definer set search_path = '' as
$$
declare me uuid := (select auth.uid()); old uuid;
begin
  if me is null then return jsonb_build_object('error', 'not_signed_in'); end if;
  if not exists (select 1 from public.rooms where code = r) then return jsonb_build_object('error', 'no_room'); end if;
  if exists (select 1 from public.members where room = r and user_id = me) then return jsonb_build_object('ok', true); end if;
  select user_id into old from public.members where room = r and lower(name) = lower(trim(nm));
  if old is null then return jsonb_build_object('error', 'no_such_player'); end if;
  update public.members set user_id = me where room = r and user_id = old;
  return jsonb_build_object('ok', true, 'rejoined', true);
end
$$;
revoke execute on function public.qmb_rejoin(text, text) from anon, public;
grant  execute on function public.qmb_rejoin(text, text) to authenticated;
