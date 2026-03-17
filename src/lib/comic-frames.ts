import { readdirSync, statSync } from "fs";
import { join } from "path";

export type ComicFrame = {
  src: string;
  alt: string;
  manuscript: string;
};

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

/**
 * Reads all storyboard frames from public/storyboard.
 *
 * Structure:
 * public/storyboard/
 *   01 SOME CHAPTER/
 *     frame1.png
 *   02 ANOTHER CHAPTER/
 *     frame2.png
 *
 * We:
 * - sort chapter folders alphabetically
 * - inside each, sort image filenames alphabetically
 * - flatten everything til en sekvens av frames
 */
export function getComicFrames(manuscriptLines: string[]): ComicFrame[] {
  const storyboardRoot = join(process.cwd(), "public", "storyboard");
  type FramePath = { src: string };
  const frames: FramePath[] = [];

  try {
    const chapterDirs = readdirSync(storyboardRoot)
      .filter((entry) => {
        const full = join(storyboardRoot, entry);
        try {
          return statSync(full).isDirectory();
        } catch {
          return false;
        }
      })
      .sort(); // e.g. "01 INTRO", "02 BUILDING A FIRE", ...

    for (const chapter of chapterDirs) {
      const chapterPath = join(storyboardRoot, chapter);
      const maybeCropped = join(chapterPath, "cropped");

      let dirForChapter = chapterPath;
      // If a cropped subfolder exists and has images, prefer that.
      try {
        const croppedFiles = readdirSync(maybeCropped).filter((name) =>
          IMAGE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
        );
        if (croppedFiles.length > 0) {
          dirForChapter = maybeCropped;
        }
      } catch {
        // no cropped folder; ignore
      }

      const files = readdirSync(dirForChapter)
        .filter((name) =>
          IMAGE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
        )
        .sort();

      for (const file of files) {
        const relative =
          dirForChapter === maybeCropped
            ? `/storyboard/${chapter}/cropped/${file}`
            : `/storyboard/${chapter}/${file}`;
        frames.push({ src: relative });
      }
    }
  } catch {
    return [];
  }

  return frames.map((frame, index) => ({
    src: frame.src,
    alt: `North of Hell — Frame ${index + 1}`,
    manuscript: manuscriptLines[index] ?? "",
  }));
}
