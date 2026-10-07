"use client";
import { useRef } from "react";

export function ChapterJump({ chapters, iconOnly = false }: { chapters: { id: string; title: string }[]; iconOnly?: boolean }) {
  const details = useRef<HTMLDetailsElement>(null);
  if (chapters.length < 2) return null;
  return (
    <details ref={details} className={`storyboard-jump${iconOnly ? " storyboard-jump--icon" : ""}`}>
      <summary aria-label={iconOnly ? "Go to chapter" : undefined} title={iconOnly ? "Go to chapter" : undefined}>
        {iconOnly ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 5h14M5 10h14M5 15h10M5 20h10" />
          </svg>
        ) : <>Go to chapter <span>⌄</span></>}
      </summary>
      <nav aria-label="Chapters">
        {chapters.map((chapter, index) => (
          <a key={chapter.id} href={`#chapter-${chapter.id}`} onClick={() => { if (details.current) details.current.open = false; }}>
            {String(index + 1).padStart(2, "0")} · {chapter.title}
          </a>
        ))}
      </nav>
    </details>
  );
}
