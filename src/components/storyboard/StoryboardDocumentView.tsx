import Image from "next/image";
import DOMPurify from "isomorphic-dompurify";
import type { StoryboardDocument, Section } from "@/lib/storyboard/model";
import { lineToEditorInnerHtml } from "@/lib/manuscript-html";
import { ChapterJump } from "./ChapterJump";
import "./storyboard-document.css";

export function cleanTextHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "h2", "h3", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "br", "blockquote"],
    ALLOWED_ATTR: [],
  });
}

export function SectionContent({ section, showEmptyImageSlots = false }: { section: Section; showEmptyImageSlots?: boolean }) {
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
  const images = [...section.images].sort((a, b) => a.slot - b.slot);
  if (images.length === 0 && !showEmptyImageSlots) return null;
  const count = section.layout === "single" ? 1 : section.layout === "2x2" ? 4 : section.layout === "2x3" ? 6 : 9;
  const slots = showEmptyImageSlots ? Array.from({ length: count }, (_, slot) => slot) : images.map(image => image.slot);
  return (
    <div className={`storyboard-image-grid storyboard-layout-${section.layout}`}>
      {slots.map(slot => {
        const image = images.find(item => item.slot === slot);
        return image ? <figure key={image.id}>
          <div className="storyboard-image-wrap"><Image src={image.src} alt={image.description || `Storyboard image ${image.slot + 1}`} fill unoptimized sizes="(max-width: 700px) 100vw, 50vw" /></div>
          {image.description && <figcaption>{image.description}</figcaption>}
        </figure> : <div key={`empty-${slot}`} className="storyboard-empty-slot" aria-hidden="true" />;
      })}
    </div>
  );
}

export function StoryboardDocumentView({ document }: { document: StoryboardDocument }) {
  return (
    <main className="storyboard-document" aria-label="Published storyboard">
      <header className="storyboard-document-header"><p>NORTH OF HELL</p><h1>{document.title}</h1></header>
      <ChapterJump chapters={document.chapters.map(chapter => ({ id: chapter.id, title: chapter.title }))} />
      {document.chapters.map((chapter, index) => (
        <article key={chapter.id} id={`chapter-${chapter.id}`} className="storyboard-chapter">
          <header className="storyboard-chapter-header"><span>Chapter {String(index + 1).padStart(2, "0")}</span><h2>{chapter.title}</h2></header>
          {chapter.sections.filter(section => section.kind !== "images" || section.images.length > 0).map(section => (
            <section key={section.id} id={`section-${section.id}`} className="storyboard-section">
              {section.kind === "text" && <h3>{section.title}</h3>}
              <SectionContent section={section} />
            </section>
          ))}
        </article>
      ))}
    </main>
  );
}
