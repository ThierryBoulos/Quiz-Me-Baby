-- 8 Nov: moving the TV to another laptop works in every kind of game (the owner: "does this apply to all types of
-- games?"). Until now only the host could get the 6-digit code, so in a two-team night with no host a dead TV laptop
-- meant the night was lost. Now, when the room has no host, either captain can get it too (the captains run a
-- no-host night). With a host, it stays the host's. The rest of the function is as before; nothing is deleted.
create or replace function public.qmb_tv_code(r text) returns jsonb
  language plpgsql security definer set search_path = '' as
$$
declare c text; myrole text;
begin
  select role into myrole from public.members where room = r and user_id = (select auth.uid());
  if myrole is distinct from 'host'
     and not (myrole = 'captain' and not exists (select 1 from public.members where room = r and role = 'host')) then
    return jsonb_build_object('error', 'not_host'); end if;
  if not exists (select 1 from private.tv_backup where room = r) then return jsonb_build_object('error', 'no_backup'); end if;
  c := lpad((floor(random() * 1000000))::int::text, 6, '0');
  update private.tv_backup set code = c, code_until = now() + interval '10 minutes', tries = 0 where room = r;
  return jsonb_build_object('ok', true, 'code', c,
    'saved', (select extract(epoch from now() - saved_at)::int from private.tv_backup where room = r));
end
$$;

revoke execute on function public.qmb_tv_code(text) from anon, public;
grant  execute on function public.qmb_tv_code(text) to authenticated;
