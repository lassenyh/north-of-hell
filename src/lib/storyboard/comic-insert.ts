import { insertNumberedSection, newId, safeImageSource, type ComicSection, type StoryboardDocument } from "./model";

export function createComicSection(src = ""): ComicSection {
  return { id: newId(), kind: "comic", title: "New comic section", src, description: "", aspect: "16:9", imageWidth: 800, imageHeight: 450, topSpace: 200, bottomSpace: 0, background: "#000000", bubbles: [], sounds: [] };
}

export function insertComicImages(document: StoryboardDocument, chapterId: string, sources: string[], afterSectionId?: string) {
  const chapter = document.chapters.find(chapter => chapter.id === chapterId);
  if (!chapter) throw new Error("This chapter is no longer available.");
  if (!sources.length) throw new Error("Select at least one image.");
  if (sources.some(src => !src || !safeImageSource(src))) throw new Error("One of the images has an invalid source.");
  if (chapter.sections.length + sources.length > 500) throw new Error(`This chapter has room for ${Math.max(0, 500 - chapter.sections.length)} more sections.`);
  if (afterSectionId && !chapter.sections.some(section => section.id === afterSectionId)) throw new Error("The insertion point is no longer available.");
  const sections = sources.map(createComicSection);
  let after = afterSectionId;
  for (const section of sections) {
    insertNumberedSection(document, chapterId, section, after);
    after = section.id;
  }
  return sections;
}
