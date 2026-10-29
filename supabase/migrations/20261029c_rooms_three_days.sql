-- 29 Oct: rooms are kept 3 days, not 1, so a night that went wrong can still be read the day after
-- tomorrow (the TV now leaves its last errors in rooms.state.errs). Same nightly job, same user clean-up.
create or replace function private.qmb_cleanup() returns jsonb
  language plpgsql security definer set search_path = '' as
$$
declare n_rooms int; n_users int;
begin
  delete from public.rooms where created_at < now() - interval '3 days';
  get diagnostics n_rooms = row_count;
  delete from auth.users u
   where u.is_anonymous and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '30 days'
     and not exists (select 1 from public.members m where m.user_id = u.id)
     and not exists (select 1 from public.rooms ro where ro.tv_id = u.id);
  get diagnostics n_users = row_count;
  return jsonb_build_object('rooms', n_rooms, 'users', n_users);
end
$$;
