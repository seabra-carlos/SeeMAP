-- For the schema already created in the Supabase SQL Editor in this conversation.
-- Does not create or drop tables. Run only in the SeeMAP project.
begin;
alter table public.profiles enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.profiles from anon, authenticated;
revoke select on public.profiles from anon;
grant select on public.profiles to authenticated;
commit;
