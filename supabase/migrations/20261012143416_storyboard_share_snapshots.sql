-- Fixed share links retain one immutable storyboard document per generated URL.
-- Only the application server reads and creates snapshots. Public readers use
-- the Next.js share route, so draft data is never exposed through the Data API.
create table public.storyboard_share_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_slug text not null references public.storyboard_documents(project_slug) on delete cascade,
  published_version bigint not null,
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  asset_sources text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index storyboard_share_snapshots_project_created_idx
  on public.storyboard_share_snapshots (project_slug, created_at desc);
create index storyboard_share_snapshots_assets_idx
  on public.storyboard_share_snapshots using gin (asset_sources);

alter table public.storyboard_share_snapshots enable row level security;
revoke all on public.storyboard_share_snapshots from anon, authenticated;
grant select, insert on public.storyboard_share_snapshots to service_role;
