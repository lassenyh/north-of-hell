-- =============================================================================
-- Admin-innlogging: brukere som kun kan åpne /admin (storyboard editor)
-- Skiller fra project_logins (hovedside → intro → main).
-- Første admin må opprettes manuelt i SQL eller Table Editor, deretter kan
-- flere legges til under «Admin access» i admin-UI.
-- =============================================================================

create table if not exists public.project_admin_logins (
  id uuid primary key default gen_random_uuid(),
  project_slug text not null,
  username text not null,
  password text not null,
  created_at timestamptz not null default now(),
  unique (project_slug, username)
);

alter table public.project_admin_logins enable row level security;

create policy "Allow anon read admin logins"
  on public.project_admin_logins for select
  using (true);

create policy "Allow anon write admin logins"
  on public.project_admin_logins for all
  using (true)
  with check (true);

-- Kolonne for visningsnavn (brukes av admin-UI). Kjør alltid denne linjen
-- hvis tabellen ble opprettet før full_name fantes:
alter table public.project_admin_logins
  add column if not exists full_name text;

-- Eksempel første bruker (endre passord):
-- insert into public.project_admin_logins (project_slug, username, password)
-- values ('north-of-hell', 'admin', 'ditt-passord');
