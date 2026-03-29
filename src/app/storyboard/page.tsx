/**
 * Public storyboard page: read-only view of images and manuscript text.
 * Data comes from Supabase (storyboard_frames table).
 * If the table is empty, run the seed from the admin page first.
 */

import Link from "next/link";
import { getStoryboardFrames } from "@/lib/supabase/storyboard";
import { StoryboardFramesWithScreenplay } from "@/components/storyboard/StoryboardFramesWithScreenplay";

export const dynamic = "force-dynamic";

export default async function StoryboardPage() {
  const frames = await getStoryboardFrames();

  if (frames.length === 0) {
    return (
      <div className="min-h-screen bg-black p-8 text-center text-zinc-400">
        <p className="mb-4">No storyboard frames yet.</p>
        <p className="mb-6 text-sm">
          Run the seed from the{" "}
          <Link href="/admin" className="underline text-[#eaa631]">
            admin page
          </Link>{" "}
          to load images from <code className="bg-zinc-800 px-1 rounded">public/storyboard</code>.
        </p>
        <Link
          href="/admin"
          className="inline-block rounded bg-[#eaa631] px-4 py-2 text-black font-medium"
        >
          Go to Admin
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 md:px-8">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-medium uppercase tracking-tight text-[#eaa631] sm:text-3xl">
            Storyboard
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Read-only view ·{" "}
            <Link href="/admin" className="underline hover:text-zinc-300">
              Edit in admin
            </Link>
          </p>
        </header>

        <StoryboardFramesWithScreenplay frames={frames} />

        <div className="mt-16 h-12" />
      </div>
    </div>
  );
}
