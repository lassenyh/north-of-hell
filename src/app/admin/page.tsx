/**
 * Admin page: edit manuscript text for each storyboard frame.
 * Data is loaded from Supabase. If the table is empty, use "Seed database" to
 * populate it from the images in public/storyboard.
 */

import Link from "next/link";
import { getStoryboardFrames } from "@/lib/supabase/storyboard";
import { AdminEditor } from "./AdminEditor";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const frames = await getStoryboardFrames();

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 md:px-8">
        <header className="mb-10 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-medium uppercase tracking-tight text-[#eaa631] sm:text-4xl [font-family:var(--font-im-fell-english),serif]">
              North of Hell
            </h1>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-500 sm:text-sm">
              Admin · Storyboard
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-zinc-500 underline hover:text-zinc-300"
          >
            ← Home
          </Link>
        </header>

        <AdminEditor frames={frames} />
      </div>
    </div>
  );
}
