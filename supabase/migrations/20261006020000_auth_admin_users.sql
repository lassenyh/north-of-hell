-- Only explicitly approved Supabase Auth users may open the project admin.
create table if not exists public.project_admin_auth_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  project_slug text not null,
  created_at timestamptz not null default now()
);

alter table public.project_admin_auth_users enable row level security;
revoke all on public.project_admin_auth_users from anon, authenticated;
grant select, insert, delete on public.project_admin_auth_users to service_role;
