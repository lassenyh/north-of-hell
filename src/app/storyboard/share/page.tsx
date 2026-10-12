import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoryboardDocumentView } from "@/components/storyboard/StoryboardDocumentView";
import { StoryboardTheme } from "@/components/storyboard/StoryboardTheme";
import { loadLatestPublishedStoryboard } from "@/lib/storyboard/share-server";
import { SHARED_STORYBOARD_HEADER_SECTION_ID } from "@/lib/storyboard/share";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Shared storyboard | North of Hell",
  robots: { index: false, follow: false },
};

export default async function SharedStoryboardPage() {
  const published = await loadLatestPublishedStoryboard();
  if (!published) notFound();

  return <StoryboardTheme><StoryboardDocumentView document={published.document} floatingChapterJump showReaderTour headerSectionId={SHARED_STORYBOARD_HEADER_SECTION_ID} /></StoryboardTheme>;
}
