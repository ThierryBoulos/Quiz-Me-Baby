-- From 30 Oct 2026 Supabase no longer gives a new table in "public" Data API access by itself. These
-- four tables were made before that, and the live project keeps their grants; this spells them out, so
-- a database rebuilt from these files (a new project, a preview branch, a local reset) can still reach
-- them. A table added later needs its own grants, in the migration that creates it.
-- Row-level security still decides who sees and does what: every policy is for "authenticated" (a
-- phone signs in anonymously, and that is "authenticated" too). "anon" only reads, and sees nothing:
-- the health check (/api/health, the keep-awake job) reads a room with it to prove the database is up.
grant select on public.rooms, public.members, public.actions, public.secrets to anon;
grant select, insert, update, delete on public.rooms, public.members, public.actions, public.secrets to authenticated;
grant select, insert, update, delete on public.rooms, public.members, public.actions, public.secrets to service_role;
