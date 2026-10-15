import type { ComicSection, StoryboardDocument } from "./model";
import { COMIC_RENDER_VERSION, layoutBubbleText } from "./comic-svg";

// Only these fields change the pixels in a rendered comic. Editorial titles,
// descriptions and image metadata can change without rebuilding the image.
export function comicVisualKey(section: ComicSection) {
  return JSON.stringify({
    crop: section.crop, src: section.src, aspect: section.aspect, topSpace: section.topSpace,
    bottomSpace: section.bottomSpace, background: section.background,
    bubbles: section.bubbles, sounds: section.sounds,
  });
}

export function prepareComicPublication(draft: StoryboardDocument, previous: StoryboardDocument | null) {
  const published = structuredClone(draft);
  const previousById = new Map(previous?.chapters.flatMap(chapter => chapter.sections)
    .filter((section): section is ComicSection => section.kind === "comic")
    .map(section => [section.id, section]) ?? []);
  const renderJobs: ComicSection[] = [];

  for (const chapter of published.chapters) for (const section of chapter.sections) {
    if (section.kind !== "comic" || !section.src) continue;
    const overflowing = section.bubbles.find(bubble => !layoutBubbleText(bubble).fits);
    if (overflowing) throw new Error(`Text does not fit a ${overflowing.shape === "rectangle" ? "text panel" : "bubble"} in “${section.title}”. Enlarge it or shorten the text.`);
    const old = previousById.get(section.id);
    if (old?.renderedSrc && old.renderVersion === COMIC_RENDER_VERSION && comicVisualKey(old) === comicVisualKey(section)) {
      section.renderedSrc = old.renderedSrc;
      section.renderVersion = COMIC_RENDER_VERSION;
      section.imageWidth = old.imageWidth;
      section.imageHeight = old.imageHeight;
    } else {
      renderJobs.push(section);
    }
  }
  return { published, renderJobs };
}

export async function renderComicJobs(
  jobs: ComicSection[],
  render: (section: ComicSection) => Promise<{ src: string; imageWidth: number; imageHeight: number }>,
  concurrency = 2,
) {
  let cursor = 0;
  let failed = false;
  let failure: unknown;
  const worker = async () => {
    while (!failed && cursor < jobs.length) {
      const section = jobs[cursor++];
      try {
        const rendered = await render(section);
        section.renderedSrc = rendered.src;
        section.renderVersion = COMIC_RENDER_VERSION;
        section.imageWidth = rendered.imageWidth;
        section.imageHeight = rendered.imageHeight;
      } catch (error) {
        failed = true;
        failure = error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), jobs.length) }, worker));
  if (failed) throw failure;
}
