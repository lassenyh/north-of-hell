-- Fullt navn for admin-brukere (valgfritt i UI)

alter table public.project_admin_logins
  add column if not exists full_name text;
