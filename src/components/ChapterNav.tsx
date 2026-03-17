"use client";

import { useEffect, useRef, useState } from "react";

type ChapterNavProps = {
  chapters: {
    id: string;
    label: string;
    firstFrameIndex: number;
  }[];
};

export function ChapterNav({ chapters }: ChapterNavProps) {
  const [activeId, setActiveId] = useState<string | null>(
    chapters[0]?.id ?? null
  );
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chapters.length) return;

    const observers: IntersectionObserver[] = [];

    chapters.forEach((chapter) => {
      const target = document.getElementById(
        `comic-frame-${chapter.firstFrameIndex}`
      );
      if (!target) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveId(chapter.id);
            }
          });
        },
        {
          threshold: 0.3,
          rootMargin: "0px 0px -50% 0px",
        }
      );

      observer.observe(target);
      observers.push(observer);
    });

    return () => {
      observers.forEach((o) => o.disconnect());
    };
  }, [chapters]);

  if (!chapters.length) return null;

  const activeChapter = chapters.find((c) => c.id === activeId);
  const currentValue = activeChapter?.id ?? chapters[0]?.id ?? "";

  return (
    <nav
      ref={panelRef}
      className="sticky top-0 z-30 mb-10 border-b border-zinc-800/70 bg-black/80 px-0 py-3 backdrop-blur"
    >
      <div className="relative mx-auto max-w-[1200px] px-4 sm:px-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Chapters
          </span>
          <div className="relative inline-block min-w-[220px]">
            <select
              value={currentValue}
              onChange={(e) => {
                const id = e.target.value;
                setActiveId(id);
                const chapter = chapters.find((c) => c.id === id);
                if (!chapter) return;
                const target = document.getElementById(
                  `comic-frame-${chapter.firstFrameIndex}`
                );
                if (target) {
                  target.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }
              }}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-[#eaa631] focus:outline-none focus:ring-1 focus:ring-[#eaa631]"
            >
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </nav>
  );
}
