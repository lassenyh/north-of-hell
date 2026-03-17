"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ChapterNavProps = {
  chapters: {
    id: string;
    label: string;
    firstFrameIndex: number;
  }[];
  layout: "list" | "grid";
  onLayoutChange: (layout: "list" | "grid") => void;
  /** Main page: list first + list default; admin: grid first + grid default */
  layoutToggleOrder?: "list-first" | "grid-first";
};

function getChapterAnchorEl(firstFrameIndex: number): HTMLElement | null {
  return (
    document.getElementById(`chapter-title-${firstFrameIndex}`) ??
    document.getElementById(`comic-frame-${firstFrameIndex}`)
  );
}

export function ChapterNav({
  chapters,
  layout,
  onLayoutChange,
  layoutToggleOrder = "grid-first",
}: ChapterNavProps) {
  const [activeId, setActiveId] = useState<string | null>(
    chapters[0]?.id ?? null
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const initialTopRef = useRef<number | null>(null);
  const [showLogo, setShowLogo] = useState(false);
  const chaptersRef = useRef(chapters);
  chaptersRef.current = chapters;

  /** Under meny-valgt kapittel: ikke la scroll-spy overskrive (smooth scroll er fortsatt i forrige kapittel). */
  const chapterSelectLockRef = useRef(false);
  const chapterScrollSessionRef = useRef(0);

  /**
   * Scrollspy: finn siste kapittel (fra bunn av lista) hvis start ligger på eller over
   * en vertikal «probe» ~1/3 ned i viewporten. Bakover-søk unngår at 02-tittel under nav
   * gjør at 01 fortsatt «vinner» (som med én linje rett under nav).
   */
  const updateActiveFromScroll = useCallback(() => {
    if (chapterSelectLockRef.current) return;

    const list = chaptersRef.current;
    if (!list.length) return;

    const probeDocY =
      window.scrollY + Math.min(window.innerHeight * 0.32, 420);

    let bestId = list[0].id;
    for (let i = list.length - 1; i >= 0; i--) {
      const ch = list[i];
      const el = getChapterAnchorEl(ch.firstFrameIndex);
      if (!el) continue;
      const top = el.getBoundingClientRect().top + window.scrollY;
      if (top <= probeDocY) {
        bestId = ch.id;
        break;
      }
    }
    setActiveId((prev) => (prev === bestId ? prev : bestId));
  }, []);

  useEffect(() => {
    if (!chapters.length) return;

    updateActiveFromScroll();

    let raf = 0;
    const onScrollOrResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateActiveFromScroll);
    };

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    const t = window.setTimeout(updateActiveFromScroll, 200);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      window.clearTimeout(t);
    };
  }, [chapters, layout, updateActiveFromScroll]);

  useEffect(() => {
    const panel = panelRef.current;
    if (panel && initialTopRef.current === null) {
      initialTopRef.current = panel.offsetTop;
    }

    const onScroll = () => {
      if (initialTopRef.current === null) return;
      setShowLogo(window.scrollY >= initialTopRef.current);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToChapter = useCallback(
    (chapterId: string, firstFrameIndex: number) => {
      const session = ++chapterScrollSessionRef.current;
      chapterSelectLockRef.current = true;
      setActiveId(chapterId);

      const run = () => {
        if (chapterScrollSessionRef.current !== session) return;
        const target = getChapterAnchorEl(firstFrameIndex);
        const panel = panelRef.current;
        if (!target || !panel) {
          chapterSelectLockRef.current = false;
          return;
        }

        const panelHeight = panel.getBoundingClientRect().height;
        const extra = 20;
        const targetTop = target.getBoundingClientRect().top + window.scrollY;
        const y = Math.max(0, targetTop - panelHeight - extra);

        if (Math.abs(window.scrollY - y) < 8) {
          chapterSelectLockRef.current = false;
          setActiveId(chapterId);
          requestAnimationFrame(updateActiveFromScroll);
          return;
        }

        let done = false;
        const finish = () => {
          if (done || chapterScrollSessionRef.current !== session) return;
          done = true;
          window.clearTimeout(fallbackMs);
          window.removeEventListener("scrollend", onScrollEnd);

          const el = getChapterAnchorEl(firstFrameIndex);
          const nav = panelRef.current;
          if (el && nav) {
            const h = nav.getBoundingClientRect().height;
            const top = el.getBoundingClientRect().top + window.scrollY;
            const exactY = Math.max(0, top - h - extra);
            const html = document.documentElement;
            const prev = html.style.scrollBehavior;
            html.style.scrollBehavior = "auto";
            window.scrollTo(0, exactY);
            html.style.scrollBehavior = prev;
          }

          chapterSelectLockRef.current = false;
          setActiveId(chapterId);
          requestAnimationFrame(updateActiveFromScroll);
        };

        const onScrollEnd = () => finish();
        window.addEventListener("scrollend", onScrollEnd, { once: true });
        const fallbackMs = window.setTimeout(finish, 2400);

        window.scrollTo({ top: y, behavior: "smooth" });
      };

      requestAnimationFrame(() => requestAnimationFrame(run));
    },
    [updateActiveFromScroll]
  );

  if (!chapters.length) return null;

  const activeChapter = chapters.find((c) => c.id === activeId);
  const currentValue = activeChapter?.id ?? chapters[0]?.id ?? "";

  return (
    <nav
      ref={panelRef}
      data-chapter-nav="true"
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
                const chapter = chapters.find((c) => c.id === id);
                if (!chapter) return;
                scrollToChapter(chapter.id, chapter.firstFrameIndex);
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

          <div className="ml-4 flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="uppercase tracking-[0.18em]">Layout</span>
            <div className="inline-flex rounded-full border border-zinc-700 bg-zinc-900/70 p-0.5">
              {layoutToggleOrder === "list-first" ? (
                <>
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
                </>
              ) : (
                <>
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
                </>
              )}
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
