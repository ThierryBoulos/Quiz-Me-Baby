-- The policy helpers are not an API: move them out of the exposed schema.
-- (Policies keep pointing at the same functions after a schema move.)
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.qmb_is_tv(text)   set schema private;
alter function public.qmb_role(text)    set schema private;
alter function public.qmb_team(text)    set schema private;
alter function public.qmb_in_room(text) set schema private;
create or replace function private.qmb_in_room(r text) returns boolean
  language sql stable security definer set search_path = '' as
$$ select private.qmb_is_tv(r) or exists (select 1 from public.members where room = r and user_id = (select auth.uid())) $$;
