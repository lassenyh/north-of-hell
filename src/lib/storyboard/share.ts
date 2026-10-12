import type { StoryboardDocument } from "./model";

export const SHARED_STORYBOARD_HEADER_SECTION_ID = "bc1d6df0-afac-4e45-9544-5cd03817a4fe";

export function storyboardAssetSources(document: StoryboardDocument) {
  const sources = new Set<string>();
  for (const chapter of document.chapters) for (const section of chapter.sections) {
    if (section.kind === "images") for (const image of section.images) sources.add(image.src);
    if (section.kind === "comic") {
      if (section.src) sources.add(section.src);
      if (section.renderedSrc) sources.add(section.renderedSrc);
    }
    if (section.kind === "video" && section.src) sources.add(section.src);
  }
  return [...sources];
}

export function validStoryboardShareId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}
