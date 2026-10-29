-- 29 Oct: joining goes through qmb_join only. A phone could insert its own row into members directly,
-- skipping the name cleaning (invisible characters: "Rami" and "Rami​" in one room), the game-over
-- check and the face pick. The insert policy now asks for what qmb_join guarantees anyway, so a direct
-- insert that would have slipped past it is refused; qmb_join itself passes it unchanged.
drop policy if exists members_join on public.members;
create policy members_join on public.members for insert to authenticated
  with check (
    user_id = (select auth.uid()) and role = 'player'
    and name = trim(regexp_replace(name, '[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]', '', 'g'))
    and char_length(name) <= 12
    and exists (select 1 from public.rooms where code = room and status <> 'done')
  );
