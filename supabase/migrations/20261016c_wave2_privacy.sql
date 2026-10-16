-- Wave 2, D5: keeping the answers off the players' phones.
--
-- 1. A room (its screen, its state) is readable only by the people in it and
--    its TV. Before, any signed-in phone could list every game in progress and
--    watch any game by its code without joining. The join page asks
--    qmb_room_state (20261016) instead of reading the room.
-- 2. qmb_sees_answers: is this phone the room's TV or its host? Party's
--    /api/bank serves the bank with the answers only to them; every other
--    phone has a bank without answers.

alter policy rooms_read on public.rooms using (private.qmb_in_room(code));

create or replace function public.qmb_sees_answers(r text) returns boolean
  language sql stable security definer set search_path = '' as
$$ select private.qmb_is_tv(r) or coalesce(private.qmb_role(r) = 'host', false) $$;
revoke execute on function public.qmb_sees_answers(text) from public, anon;
grant  execute on function public.qmb_sees_answers(text) to authenticated;
