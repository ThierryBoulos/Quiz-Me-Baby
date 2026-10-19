-- 19 Oct: an answer typed but not sent when the clock runs out still counts.
-- While a captain types, their phone quietly sends what's in the box (kind
-- 'draft'); at time-up the TV takes the last one as their answer. Readable,
-- like every action, only by the TV, the host and the phone that sent it.

alter table public.actions drop constraint actions_kind_check;
alter table public.actions add constraint actions_kind_check
  check (kind in ('buzz','answer','suggest','bid','count','judge','next','setup','team_name','lifeline','draft'));
