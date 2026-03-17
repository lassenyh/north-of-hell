"use client";

import { useEffect, useRef, useState } from "react";

type ChapterNavProps = {
  chapters: {
    id: string;
    label: string;
    firstFrameIndex: number;
  }[];
  layout: "list" | "grid";
  onLayoutChange: (layout: "list" | "grid") => void;
};

export function ChapterNav({ chapters, layout, onLayoutChange }: ChapterNavProps) {
  const [activeId, setActiveId] = useState<string | null>(
    chapters[0]?.id ?? null
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const initialTopRef = useRef<number | null>(null);
  const [showLogo, setShowLogo] = useState(false);

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

  useEffect(() => {
    const panel = panelRef.current;
    if (panel && initialTopRef.current === null) {
      // Hvor langt ned fra toppen panel-nav'en ligger før den blir sticky
      initialTopRef.current = panel.offsetTop;
    }

    const onScroll = () => {
      if (initialTopRef.current === null) return;
      // Når vi har scrollet forbi nav'ens opprinnelige posisjon, er den sticky i toppen
      setShowLogo(window.scrollY >= initialTopRef.current);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!chapters.length) return null;

  const activeChapter = chapters.find((c) => c.id === activeId);
  const currentValue = activeChapter?.id ?? chapters[0]?.id ?? "";

  return (
    <nav
      ref={panelRef}
      className="sticky top-0 z-30 mb-10 border-b border-zinc-800/70 bg-black/80 px-0 py-3 backdrop-blur"
    >
      <div className="relative mx-auto flex max-w-[1200px] items-center justify-between px-4 sm:px-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Chapters
          </span>
          <div className="relative inline-block min-w-[200px]">
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
              className="w-full rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[11px] text-zinc-100 outline-none focus:border-[#eaa631] focus:outline-none focus:ring-1 focus:ring-[#eaa631]"
            >
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.label}
                </option>
              ))}
            </select>
          </div>

          {/* Layout toggle – del av samme sticky meny */}
          <div className="ml-4 flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="uppercase tracking-[0.18em]">
              Layout
            </span>
            <div className="inline-flex rounded-full border border-zinc-700 bg-zinc-900/70 p-0.5">
              <button
                type="button"
                onClick={() => onLayoutChange("list")}
                className={`rounded-full px-2.5 py-0.5 transition ${
                  layout === "list"
                    ? "bg-zinc-100 text-black"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => onLayoutChange("grid")}
                className={`rounded-full px-2.5 py-0.5 transition ${
                  layout === "grid"
                    ? "bg-zinc-100 text-black"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Grid
              </button>
            </div>
          </div>
        </div>
        <div
          className={`text-sm font-medium uppercase tracking-tight text-[#eaa631] transition-opacity duration-300 sm:text-base [font-family:var(--font-im-fell-english),serif] ${
            showLogo ? "opacity-100" : "opacity-0"
          }`}
        >
          North of Hell
        </div>
      </div>
    </nav>
  );
}
