-- Match SNAKED's join conventions: codes from 23456789ABCDEFGHJKMNPQRSTUVWXYZ
-- (no 0/O/1/I/L), names up to 12 characters and unique per room, a face per player.
alter table public.rooms drop constraint rooms_code_check;
alter table public.rooms add constraint rooms_code_check check (code ~ '^[2-9A-HJKMNP-Z]{4}$');
alter table public.members drop constraint members_name_check;
alter table public.members add constraint members_name_check check (char_length(name) between 1 and 12);
alter table public.members add column avatar text;
create unique index members_name_unique on public.members (room, lower(name));
create unique index members_avatar_unique on public.members (room, avatar) where avatar is not null;
create or replace function public.qmb_create_room() returns text
  language plpgsql security definer set search_path = '' as
$$
declare c text; letters text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  loop
    c := '';
    for i in 1..4 loop c := c || substr(letters, 1 + floor(random() * length(letters))::int, 1); end loop;
    exit when not exists (select 1 from public.rooms where code = c);
  end loop;
  insert into public.rooms (code, tv_id) values (c, (select auth.uid()));
  insert into public.secrets (room) values (c);
  return c;
end
$$;
