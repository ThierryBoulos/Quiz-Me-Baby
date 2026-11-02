-- 2 Nov: two more faces (the owner): 18 fill three rows of six on the join screen. Appended, so every
-- face already taken in a room keeps its place in the order.
create or replace function private.qmb_faces() returns text[]
  language sql immutable set search_path = '' as
$$ select array['🦊','🐼','🐸','🦁','🐙','🦄','🐯','🐨','🐵','🐧','🦉','🐝','🐳','🦖','🐷','🐻','🐶','🐱'] $$;
