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

## 4. Create the database table

1. In Supabase, open **SQL Editor** → **New query**.
2. Open the file `supabase/migrations/001_storyboard_frames.sql` in this repo.
3. Copy its entire contents into the SQL Editor and click **Run**.

You should see “Success. No rows returned.” That means the `storyboard_frames` table and its policies are created.

## 5. Seed the table from your images

The app uses images that are already in `public/storyboard/` (chapter folders). To copy that list into Supabase:

1. Start the app: `npm run dev`.
2. Open [http://localhost:3000/admin](http://localhost:3000/admin).
3. Click **“Seed database from current images”**.

After a moment the page will reload and you’ll see one row per image with a textarea. You can now add or edit manuscript text and click **Save** per frame.

## 6. Use the app

- **Public (read-only):** [http://localhost:3000/storyboard](http://localhost:3000/storyboard) — shows all frames and their text.
- **Admin (edit):** [http://localhost:3000/admin](http://localhost:3000/admin) — edit text and save to Supabase.

## Files involved

| File | Purpose |
|------|--------|
| `.env.local.example` | Template for Supabase URL and anon key. Copy to `.env.local` and fill in. |
| `supabase/migrations/001_storyboard_frames.sql` | SQL to create the `storyboard_frames` table and RLS policies. Run once in Supabase SQL Editor. |
| `src/lib/supabase/client.ts` | Browser Supabase client for Client Components. |
| `src/lib/supabase/server.ts` | Server Supabase client (uses cookies) for Server Components and API routes. |
| `src/lib/supabase/storyboard.ts` | Fetches frames and updates frame text. Used by storyboard + admin pages and API. |
| `src/app/api/seed/route.ts` | `POST /api/seed` — fills `storyboard_frames` from `public/storyboard` images. |
| `src/app/storyboard/page.tsx` | Public page: lists frames and text from Supabase. |
| `src/app/admin/page.tsx` | Admin page: loads frames and renders `AdminEditor`. |
| `src/app/admin/AdminEditor.tsx` | Client UI: textarea per frame, Save button, Seed button. |
| `src/app/admin/actions.ts` | Server Action that calls `updateFrameText` when you click Save. |

## Troubleshooting

- **“No frames in the database”**  
  Run the seed from the admin page (step 5). Ensure `public/storyboard` has at least one chapter folder with images.

- **Seed or save fails**  
  Check that `.env.local` has the correct URL and anon key and that you ran the SQL migration (step 4).

- **Images don’t show**  
  Image paths are stored as in `public/storyboard/...`. They must be served from your app; if you moved or renamed folders, run the seed again.
