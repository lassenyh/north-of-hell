-- Draft and published snapshots are independent JSON documents. Only the
-- application server (with a server key) can access this table.
create table if not exists public.storyboard_documents (
  project_slug text primary key,
  draft jsonb not null,
  published jsonb,
  draft_version bigint not null default 1,
  published_version bigint,
  saved_at timestamptz not null default now(),
  published_at timestamptz,
  constraint storyboard_draft_object check (jsonb_typeof(draft) = 'object'),
  constraint storyboard_published_object check (published is null or jsonb_typeof(published) = 'object')
);
alter table public.storyboard_documents enable row level security;
revoke all on public.storyboard_documents from anon, authenticated;
grant select, insert, update on public.storyboard_documents to service_role;

-- Uploads are performed by the server with its service key. Public images can
-- be displayed by readers without exposing draft document data.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('storyboard-images', 'storyboard-images', true, 10485760,
        array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;
