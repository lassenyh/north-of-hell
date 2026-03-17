import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ComicScrollPage } from "@/components/ComicScrollPage";
import { getStoryboardFrames } from "@/lib/supabase/storyboard";
import type { ComicFrame } from "@/lib/comic-frames";

// Avoid static prerender at build time (needs Supabase at request time)
export const dynamic = "force-dynamic";

export default async function MainPage() {
  const cookieStore = await cookies();
  const auth = cookieStore.get("noh_auth")?.value;
  if (!auth) {
    redirect("/login");
  }

  // Load frames + text from Supabase instead of local placeholders.
  const dbFrames = await getStoryboardFrames();

  // Map Supabase rows to the ComicFrame shape used by ComicScrollPage.
  const frames: ComicFrame[] = dbFrames.map((f, index) => ({
    src: f.image_src,
    alt: `North of Hell — Frame ${index + 1}`,
    manuscript: f.text ?? "",
  }));

  // If the database is empty (e.g. before seeding), fall back to the original
  // file-based frames so the page still renders.
  if (frames.length === 0) {
    const { getComicFrames } = await import("@/lib/comic-frames");
    const { manuscriptPlaceholders } = await import("@/data/manuscript");
    return <ComicScrollPage frames={getComicFrames(manuscriptPlaceholders)} />;
  }

  return <ComicScrollPage frames={frames} />;
}

