import { imageCropStyle } from "@/lib/storyboard/image-crop";
import Image from "next/image";
import type { StoryboardDocument, Section, ComicSection } from "@/lib/storyboard/model";
import { lineToEditorInnerHtml } from "@/lib/manuscript-html";
import { sanitizeHtml } from "@/lib/safe-html";
import { COMIC_RENDER_VERSION, comicHeight, renderComicSvg } from "@/lib/storyboard/comic-svg";
import { ChapterJump } from "./ChapterJump";
import { StoryboardReaderControls } from "./StoryboardReaderControls";
import type { ReaderSection } from "@/lib/storyboard/reader-progress";
import "./storyboard-document.css";

export function cleanTextHtml(html: string) {
  return sanitizeHtml(html, { tags: ["p", "h2", "h3", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "br", "blockquote"] });
}

export function SectionContent({ section, showEmptyImageSlots = false, preferSourceComic = false }: { section: Section; showEmptyImageSlots?: boolean; preferSourceComic?: boolean }) {
  if (section.kind === "text") return (
    <div className="storyboard-prose" style={{ textAlign: section.align, fontSize: `${section.size}px` }}
      dangerouslySetInnerHTML={{ __html: cleanTextHtml(section.html) }} />
  );
  if (section.kind === "screenplay") return (
    <div className="storyboard-script" aria-label="Screenplay">
      {section.blocks.map((block, index) => (
        <div key={index} data-block-type={block.type} dangerouslySetInnerHTML={{ __html: lineToEditorInnerHtml(block.text) }} />
      ))}
    </div>
  );
  if (section.kind === "comic") return !preferSourceComic && section.renderedSrc && section.renderVersion === COMIC_RENDER_VERSION ? (
    <div className="storyboard-comic-image"><Image src={section.renderedSrc} alt={section.description || section.title} width={800} height={comicHeight(section)} unoptimized sizes="(max-width: 800px) 100vw, 800px" /></div>
  ) : <div className="storyboard-comic-image" dangerouslySetInnerHTML={{ __html: renderComicSvg(section) }} />;
  if (section.kind === "video") return section.src ? (
    <div className="storyboard-video"><video src={section.src} controls playsInline preload="metadata" aria-label={section.title} /></div>
  ) : null;
  const images = [...section.images].sort((a, b) => a.slot - b.slot);
  if (images.length === 0 && !showEmptyImageSlots) return null;
  const count = section.layout === "single" ? 1 : section.layout === "1x2" ? 2 : section.layout === "2x2" ? 4 : section.layout === "2x3" ? 6 : 9;
  const slots = showEmptyImageSlots ? Array.from({ length: count }, (_, slot) => slot) : images.map(image => image.slot);
  return (
    <div className={`storyboard-image-grid storyboard-layout-${section.layout}`}>
      {slots.map(slot => {
        const image = images.find(item => item.slot === slot);
        return image ? <figure key={image.id}>
          <div className="storyboard-image-wrap"><Image style={imageCropStyle(image.crop)} src={image.src} alt={image.description || `Storyboard image ${image.slot + 1}`} fill unoptimized sizes="(max-width: 700px) 100vw, 50vw" /></div>
          {image.description && <figcaption>{image.description}</figcaption>}
        </figure> : <div key={`empty-${slot}`} className="storyboard-empty-slot" aria-hidden="true" />;
      })}
    </div>
  );
}

export function StoryboardDocumentView({ document, floatingChapterJump = false, preview = false, readerScope = "live", showReaderTour = false, headerSectionId }: { document: StoryboardDocument; floatingChapterJump?: boolean; preview?: boolean; readerScope?: string; showReaderTour?: boolean; headerSectionId?: string }) {
  const chapters = document.chapters.map(chapter => ({ id: chapter.id, title: chapter.title }));
  const headerSection = headerSectionId
    ? document.chapters.flatMap(chapter => chapter.sections).find((section): section is ComicSection => section.id === headerSectionId && section.kind === "comic")
    : undefined;
  const headerImage = headerSection
    ? {
      src: headerSection.renderVersion === COMIC_RENDER_VERSION && headerSection.renderedSrc ? headerSection.renderedSrc : headerSection.src,
      height: comicHeight(headerSection),
    }
    : null;
  const readerSections: ReaderSection[] = document.chapters.flatMap((chapter, chapterIndex) => chapter.sections
    .filter(section => section.kind === "images" ? section.images.length > 0 : section.kind === "comic" || section.kind === "video" ? !!section.src : true)
    .map(section => ({ id: section.id, chapterId: chapter.id, chapterNumber: chapterIndex + 1, title: section.title })));

  return (
    <main className={`storyboard-document ${floatingChapterJump ? "storyboard-reader" : ""}`} aria-label={preview ? "Draft preview" : "Published storyboard"}>
      {floatingChapterJump && <StoryboardReaderControls chapters={chapters} sections={readerSections} scope={readerScope} showTour={showReaderTour} />}
      {preview && !floatingChapterJump && <ChapterJump chapters={chapters} />}
      <header className={`storyboard-document-header${headerImage ? " storyboard-document-header--image" : ""}`}>
        <h1>{headerImage ? <Image src={headerImage.src} alt="North of Hell" width={800} height={headerImage.height} unoptimized sizes="(max-width: 520px) 100vw, 520px" /> : document.title}</h1>
      </header>
      {!preview && !floatingChapterJump && <ChapterJump chapters={chapters} />}
      {document.chapters.map((chapter, index) => (
        <article key={chapter.id} id={`chapter-${chapter.id}`} className="storyboard-chapter">
          <header className="storyboard-chapter-header">
            <h2 aria-label={`Chapter ${index + 1}: ${chapter.title}`}><span aria-hidden="true">Chapter</span><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span></h2>
          </header>
          {chapter.sections.filter(section => section.kind === "images" ? section.images.length > 0 : section.kind === "comic" || section.kind === "video" ? !!section.src : true).map(section => (
            <section key={section.id} id={`section-${section.id}`} className={`storyboard-section storyboard-section--${section.kind}`}>
              <SectionContent section={section} preferSourceComic={preview} />
            </section>
          ))}
        </article>
      ))}
    </main>
  );
}
