import { redirect } from "next/navigation";
import StoryboardEditor from "@/components/storyboard/StoryboardEditor";
import { listStoryboardLibraryData } from "@/lib/storyboard/library";
import { loadStoryboardState, requireStoryboardEditor } from "@/lib/storyboard/server";

export const dynamic = "force-dynamic";
export default async function StoryboardAdminPage() {
  try { await requireStoryboardEditor(); } catch { redirect("/admin/login"); }
  const initial = await loadStoryboardState();
  const { library, chapters, hidden } = await listStoryboardLibraryData();
  return <StoryboardEditor initial={initial} library={library} libraryChapters={chapters} hiddenLibrary={hidden} />;
}
