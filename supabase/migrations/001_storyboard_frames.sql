-- =============================================================================
-- Storyboard frames table for the admin storyboard app
-- =============================================================================
-- Run this in the Supabase SQL Editor:
-- 1. Open your project at https://supabase.com/dashboard
-- 2. Go to SQL Editor → New query
-- 3. Paste this entire file and click "Run"
-- =============================================================================

create table if not exists public.storyboard_frames (
  id uuid primary key default gen_random_uuid(),
  project_slug text not null,
  image_src text not null,
  frame_order integer not null,
  text text not null default '',
  updated_at timestamptz not null default now(),
  unique (project_slug, image_src)
);

-- Optional: allow read/write for everyone (anon key) for this demo.
-- For production you would add Row Level Security (RLS) and restrict by user.
alter table public.storyboard_frames enable row level security;

-- Policy: allow anyone to read (for the public storyboard page)
create policy "Allow public read"
  on public.storyboard_frames for select
  using (true);

-- Policy: allow anyone to insert/update (for the admin page to save text)
-- In production you would restrict this to authenticated users only.
create policy "Allow anon insert and update"
  on public.storyboard_frames for all
  using (true)
  with check (true);

-- Index for fast lookups by project when loading the storyboard
create index if not exists idx_storyboard_frames_project_order
  on public.storyboard_frames (project_slug, frame_order);
