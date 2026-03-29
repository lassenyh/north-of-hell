import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ComicScrollPage } from "@/components/ComicScrollPage";
import { getStoryboardFrames } from "@/lib/supabase/storyboard";
import type { ComicFrame } from "@/lib/comic-frames";

// Avoid static prerender at build time (needs Supabase at request time)
export const dynamic = "force-dynamic";

export default async function StoryboardMainPage() {
  const cookieStore = await cookies();
  const auth = cookieStore.get("noh_auth")?.value;
  if (!auth) {
    redirect("/login");
  }

  const dbFrames = await getStoryboardFrames();

  const frames: ComicFrame[] = dbFrames.map((f, index) => ({
    src: f.image_src,
    alt: `North of Hell — Frame ${index + 1}`,
    manuscript: f.text ?? "",
  }));

  if (frames.length === 0) {
    const { getComicFrames } = await import("@/lib/comic-frames");
    const { manuscriptPlaceholders } = await import("@/data/manuscript");
    return <ComicScrollPage frames={getComicFrames(manuscriptPlaceholders)} />;
  }

  return <ComicScrollPage frames={frames} />;
}
