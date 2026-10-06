import { redirect } from "next/navigation";
import StoryboardEditor from "@/components/storyboard/StoryboardEditor";
import { getComicFrames } from "@/lib/comic-frames";
import { loadStoryboardState, requireStoryboardEditor } from "@/lib/storyboard/server";

export const dynamic = "force-dynamic";
export default async function StoryboardAdminPage() {
  try { await requireStoryboardEditor(); } catch { redirect("/admin/login"); }
  const initial = await loadStoryboardState();
  const library = getComicFrames([]).map(frame => frame.src);
  return <StoryboardEditor initial={initial} library={library} />;
}
