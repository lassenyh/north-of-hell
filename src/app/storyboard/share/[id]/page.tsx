import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoryboardDocumentView } from "@/components/storyboard/StoryboardDocumentView";
import { StoryboardTheme } from "@/components/storyboard/StoryboardTheme";
import { loadStoryboardShareSnapshot } from "@/lib/storyboard/share-server";
import { SHARED_STORYBOARD_HEADER_SECTION_ID } from "@/lib/storyboard/share";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Shared storyboard snapshot | North of Hell",
  robots: { index: false, follow: false },
};

export default async function SharedStoryboardSnapshotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const document = await loadStoryboardShareSnapshot(id);
  if (!document) notFound();

  return <StoryboardTheme><StoryboardDocumentView document={document} floatingChapterJump readerScope={`snapshot:${id}`} showReaderTour headerSectionId={SHARED_STORYBOARD_HEADER_SECTION_ID} /></StoryboardTheme>;
}
