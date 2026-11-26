-- Read-only verification: expected profiles columns id, full_name, role, created_at.
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' order by ordinal_position;
select tablename, policyname, cmd, roles from pg_policies
where schemaname = 'public' and tablename = 'profiles';
