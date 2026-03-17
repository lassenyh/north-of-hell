/**
 * Admin page: edit manuscript text for each storyboard frame.
 */

import { getStoryboardFrames } from "@/lib/supabase/storyboard";
import { AdminEditor } from "./AdminEditor";
import { adminLogout } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const frames = await getStoryboardFrames();

  return (
    <div className="min-h-screen w-full bg-black">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col px-6 pb-12 pt-32 sm:px-8 sm:pb-12 sm:pt-40 md:px-12 md:pt-48 lg:px-16">
        <header className="mb-16 flex flex-col gap-6 sm:mb-20">
          <div className="text-center">
            <p className="mb-4 text-xs lowercase tracking-[0.25em] text-zinc-500 sm:text-sm [font-family:var(--font-im-fell-english),serif]">
              a film by niels windfeldt
            </p>
            <h1 className="text-4xl font-medium uppercase tracking-tight text-[#eaa631] sm:text-5xl [font-family:var(--font-im-fell-english),serif]">
              North of Hell
            </h1>
            <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-zinc-600">
              Admin · Storyboard Editor
            </p>
            <form action={adminLogout} className="mt-4">
              <button
                type="submit"
                className="text-xs text-zinc-500 transition hover:text-zinc-300"
              >
                Log out
              </button>
            </form>
          </div>
        </header>

        <AdminEditor frames={frames} />
      </div>
    </div>
  );
}
