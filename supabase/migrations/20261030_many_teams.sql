-- 30 Oct: more than two teams (the "many teams" mode, phase 1). Teams 0–7 are allowed, and a room can be in
-- mode 'many'. Nothing else changes: a two-team room never has a team above 1, and one captain per team is
-- already enforced per (room, team).
alter table public.members drop constraint if exists members_team_check;
alter table public.members add constraint members_team_check check (team between 0 and 7);
alter table public.rooms drop constraint if exists rooms_mode_check;
alter table public.rooms add constraint rooms_mode_check check (mode in ('classic', 'host', 'nohost', 'many'));
