import { redirect } from "next/navigation";
import StoryboardEditor from "@/components/storyboard/StoryboardEditor";
import { getComicFrames } from "@/lib/comic-frames";
import { loadStoryboardState, requireStoryboardEditor } from "@/lib/storyboard/server";

export const dynamic = "force-dynamic";
export default async function StoryboardStudioPage() {
  try { await requireStoryboardEditor(); } catch { redirect("/admin/login"); }
  return <StoryboardEditor initial={await loadStoryboardState()} library={getComicFrames([]).map(frame => frame.src)} />;
}
