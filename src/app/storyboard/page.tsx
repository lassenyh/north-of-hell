import { MainSiteHeader } from "@/components/MainSiteHeader";
import { StoryboardDocumentView } from "@/components/storyboard/StoryboardDocumentView";
import { StoryboardTheme } from "@/components/storyboard/StoryboardTheme";
import { legacyStoryboardDocument, loadStoryboardState } from "@/lib/storyboard/server";

export const dynamic = "force-dynamic";
export default async function StoryboardPage() {
  const state = await loadStoryboardState();
  const document = state.published ?? await legacyStoryboardDocument();
  return (
    <StoryboardTheme>
      <MainSiteHeader />
      <StoryboardDocumentView document={document} floatingChapterJump />
    </StoryboardTheme>
  );
}
