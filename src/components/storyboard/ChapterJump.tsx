"use client";
import { useRef } from "react";

export function ChapterJump({ chapters }: { chapters: { id: string; title: string }[] }) {
  const details = useRef<HTMLDetailsElement>(null);
  if (chapters.length < 2) return null;
  return <details ref={details} className="storyboard-jump"><summary>Go to chapter <span>⌄</span></summary><nav aria-label="Chapters">{chapters.map((chapter,index) => <a key={chapter.id} href={`#chapter-${chapter.id}`} onClick={() => { if (details.current) details.current.open = false; }}>{String(index+1).padStart(2,"0")} · {chapter.title}</a>)}</nav></details>;
}
