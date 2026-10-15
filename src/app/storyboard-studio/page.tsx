import { redirect } from "next/navigation";
import StoryboardEditor from "@/components/storyboard/StoryboardEditor";
import { listStoryboardLibraryData } from "@/lib/storyboard/library";
import { loadStoryboardState, requireStoryboardEditor } from "@/lib/storyboard/server";

export const dynamic = "force-dynamic";
export default async function StoryboardStudioPage({ searchParams }: { searchParams: Promise<{ publishDemo?: string }> }) {
  try { await requireStoryboardEditor(); } catch { redirect("/admin/login"); }
  const { library, chapters, hidden } = await listStoryboardLibraryData();
  const demoValue = process.env.NODE_ENV === "development" ? (await searchParams).publishDemo : undefined;
  const demoPublish = demoValue === "1" ? "loading" : demoValue === "success" ? "success" : undefined;
  return <StoryboardEditor initial={await loadStoryboardState()} library={library} libraryChapters={chapters} hiddenLibrary={hidden} demoPublish={demoPublish} />;
}
