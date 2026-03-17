-- =============================================================================
-- Ekstra felt for project_logins: full_name og company
-- =============================================================================

alter table public.project_logins
  add column if not exists full_name text,
  add column if not exists company text;

