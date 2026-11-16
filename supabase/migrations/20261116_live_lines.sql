-- 16 Nov: faster taps and screens, and phones on the TV's clock (the owner's yes to "1 and 3", 15-16 Nov).
-- Nothing here is deleted or changed; it only adds. The database stays the record of every tap and every screen: the
-- live lines below are a faster copy, and a game works as before if one is slow or down.
--
-- 1. Two live lines per room (Supabase Realtime, private channels):
--    "pub:<code>"  the screens: only the room's TV (or the phone running a game with no TV) may send on it;
--                  the room's members and its TV may hear it.
--    "act:<code>"  the taps: nobody sends on it from a phone; the database sends each tap as it's written (so who
--                  sent it is the signed-in phone, never a claim in the message); only the room's TV hears it.
create or replace function public.qmb_line_ok(topic text, send boolean) returns boolean
  language sql stable security definer set search_path = '' as
$$
  select case
    when topic like 'pub:%' then exists (
      select 1 from public.rooms r where r.code = substr(topic, 5)
        and (r.tv_id = (select auth.uid())
             or (not send and exists (select 1 from public.members m where m.room = r.code and m.user_id = (select auth.uid()))))))
    when topic like 'act:%' then (not send) and exists (
      select 1 from public.rooms r where r.code = substr(topic, 5) and r.tv_id = (select auth.uid()))
    else false end
$$;
revoke all on function public.qmb_line_ok(text, boolean) from public;
grant execute on function public.qmb_line_ok(text, boolean) to authenticated;

create policy "qmb lines: who hears" on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast' and public.qmb_line_ok(realtime.topic(), false));
create policy "qmb lines: who sends" on realtime.messages for insert to authenticated
  with check (realtime.messages.extension = 'broadcast' and public.qmb_line_ok(realtime.topic(), true));

-- each new tap, sent on the room's tap line as it's written (a failure here never stops the tap being saved)
create or replace function private.qmb_action_line() returns trigger
  language plpgsql security definer set search_path = '' as
$$
begin
  perform realtime.send(
    jsonb_build_object('id', new.id, 'room', new.room, 'user_id', new.user_id, 'kind', new.kind, 'payload', new.payload, 'at', new.at),
    'action', 'act:' || new.room, true);
  return null;
exception when others then
  return null;
end
$$;
create trigger qmb_action_line after insert on public.actions
  for each row execute function private.qmb_action_line();

-- 3. The server's clock, to the millisecond: the TV and every phone ask it a few times and set their own clocks by
--    it, so every timer in the room shows the same second.
create or replace function public.qmb_now() returns bigint
  language sql volatile as
$$ select floor(extract(epoch from clock_timestamp()) * 1000)::bigint $$;
grant execute on function public.qmb_now() to anon, authenticated;
