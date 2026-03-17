# Supabase setup for the storyboard app

This guide walks you through getting the public storyboard page and admin editor working with Supabase.

## 1. Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. Click **New project**, choose your org, name the project (e.g. `north-of-hell`), set a password, and create the project.

## 2. Get your URL and anon key

1. In the project, open **Settings** (gear) → **API**.
2. Copy **Project URL** and **anon public** key. You’ll paste these into `.env.local` in the next step.

## 3. Add environment variables

1. In the project root, copy the example env file:
   ```bash
   cp .env.local.example .env.local
   ```
2. Open `.env.local` and paste your values:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon public key

Save the file. Restart the dev server (`npm run dev`) so it picks up the new variables.

## 4. Create the database tables

In **SQL Editor** → **New query**, run each migration file **once**, in order:

| Order | File | Purpose |
|-------|------|--------|
| 1 | `supabase/migrations/001_storyboard_frames.sql` | Storyboard frames + text |
| 2 | `supabase/migrations/002_project_logins.sql` | Users for **main story** (`/login` → intro → scroll) |
| 3 | `supabase/migrations/003_project_logins_profile.sql` | Optional name/company on story users |
| 4 | `supabase/migrations/004_project_admin_logins.sql` | Users for **admin editor** only (`/admin/login`) |
| 5 | `supabase/migrations/005_project_admin_logins_full_name.sql` | Optional **full name** on admin users |

## 5. First admin user (required for `/admin`)

The storyboard editor at `/admin` uses **separate** accounts from the main site.

1. In SQL Editor, create your first admin (change username/password):
   ```sql
   insert into public.project_admin_logins (project_slug, username, password)
   values ('north-of-hell', 'your-admin', 'your-secure-password');
   ```
2. Open [http://localhost:3000/admin/login](http://localhost:3000/admin/login) and sign in.
3. You’ll be redirected to `/admin`. Under the **Login access** tab you can manage **Guest access** (main story users) and **Admin access** (editor logins), and seed frames from the **Storyboard** tab.

## 6. Seed the table from your images

1. With an admin session, open [http://localhost:3000/admin](http://localhost:3000/admin).
2. On the **Storyboard** tab, click **Re-seed from disk** (or seed when the DB is empty).

## 7. Use the app

- **Main story:** [http://localhost:3000/login](http://localhost:3000/login) → intro → `/main` (users from **Login access** in admin).
- **Admin editor:** [http://localhost:3000/admin/login](http://localhost:3000/admin/login) → `/admin` (admin users listed under **Admin access** on the **Login access** tab / `project_admin_logins`).
- **Public (read-only):** [http://localhost:3000/storyboard](http://localhost:3000/storyboard).

## Files involved

| File | Purpose |
|------|--------|
| `.env.local.example` | Template for Supabase URL and anon key. Copy to `.env.local` and fill in. |
| `supabase/migrations/*.sql` | Table definitions — run in Supabase SQL Editor. |
| `src/middleware.ts` | Protects `/main`, `/intro` (story cookie) and `/admin` (admin cookie). |
| `src/app/api/seed/route.ts` | `POST /api/seed` — requires admin session. Syncs images from disk; does not overwrite saved text. |
| `src/app/admin/login/` | Admin sign-in (same look as `/login`, no intro). |

## Troubleshooting

- **`Could not find the 'full_name' column of 'project_admin_logins'`**  
  Kjør i **SQL Editor**:
  ```sql
  alter table public.project_admin_logins
    add column if not exists full_name text;
  ```
  Vent noen sekunder (eller bruk **Settings → API → Reload schema** i Supabase) og prøv igjen.

- **Redirected from `/admin` to `/admin/login`**  
  Expected until you sign in with an admin account. Create the first admin with SQL (step 5).

- **“No frames in the database”**  
  Seed from the admin **Storyboard** tab. Ensure `public/storyboard` has chapter folders with images.

- **Seed or save fails**  
  Check `.env.local` and that migrations ran. Seed returns 401 if you’re not logged in as admin.

- **Re-seed and manuscript text**  
  Re-seed never overwrites saved text on existing frames.
