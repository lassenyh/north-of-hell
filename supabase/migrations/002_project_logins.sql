-- =============================================================================
-- Enkle innloggingsbrukere for North of Hell
-- =============================================================================
-- Kjør dette i Supabase SQL Editor på samme måte som 001_storyboard_frames.sql
-- (det gir en tabell der du kan legge inn inntil ca. 10 brukere med brukernavn/passord)
-- =============================================================================

create table if not exists public.project_logins (
  id uuid primary key default gen_random_uuid(),
  project_slug text not null,
  username text not null,
  password text not null,
  created_at timestamptz not null default now(),
  unique (project_slug, username)
);

alter table public.project_logins enable row level security;

-- Demo-policy: la alle (anon) lese og skrive.
-- For ekte produksjon bør dette strammes inn.
create policy "Allow anon read logins"
  on public.project_logins for select
  using (true);

create policy "Allow anon write logins"
  on public.project_logins for all
  using (true)
  with check (true);

