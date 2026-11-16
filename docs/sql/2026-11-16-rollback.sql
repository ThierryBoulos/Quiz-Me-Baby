-- THE WAY BACK from 2026-11-16-apply.sql (the owner, 16 Nov: "keep the old version handy"). Paste into Supabase >
-- SQL editor and run it once: it removes the live lines, the tap trigger and the clock function, and the database is
-- as it was on 15 Nov. Nothing else is touched; no game data is deleted. The game then carries on through the
-- database alone, as before (it falls back by itself when the lines are gone).
begin;
drop trigger if exists qmb_action_line on public.actions;
drop function if exists private.qmb_action_line();
drop policy if exists "qmb lines: who hears" on realtime.messages;
drop policy if exists "qmb lines: who sends" on realtime.messages;
drop function if exists public.qmb_line_ok(text, boolean);
drop function if exists public.qmb_now();
commit;
