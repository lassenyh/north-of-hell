-- The original admin table granted public read/write access to credentials.
-- The application now checks signed admin sessions and uses its server key.
drop policy if exists "Allow anon read admin logins" on public.project_admin_logins;
drop policy if exists "Allow anon write admin logins" on public.project_admin_logins;
alter table public.project_admin_logins enable row level security;
revoke all on public.project_admin_logins from anon, authenticated;
grant select, insert, update, delete on public.project_admin_logins to service_role;
