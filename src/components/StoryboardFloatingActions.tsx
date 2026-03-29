"use client";

import { useEffect, useState } from "react";

const SCROLL_TOP_REVEAL_PX = 100;

/** Samme «pill»-skall som List/Grid i ChapterNav. */
const toolbarPillShellClass =
  "inline-flex shrink-0 rounded-full border border-zinc-700 bg-zinc-900/70 p-0.5";

/**
 * Samme indre mål som List/Grid: px-2.5 py-0.5 + min høyde/bredde så ikon-knappen
 * ikke blir lavere/smalere enn tekstknappene.
 */
const fullscreenBtnClass =
  "inline-flex min-h-5 min-w-10 shrink-0 items-center justify-center rounded-full px-2.5 py-0.5 text-[11px] text-zinc-400 transition hover:text-zinc-200";

function StoryboardToolbarButtons() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scrollTopUnlocked, setScrollTopUnlocked] = useState(false);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    const onScroll = () => {
      if (window.scrollY > SCROLL_TOP_REVEAL_PX) {
        setScrollTopUnlocked(true);
      }
    };

    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const toggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <div className={toolbarPillShellClass}>
        <button
          type="button"
          onClick={toggleFullscreen}
          className={fullscreenBtnClass}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
        {isFullscreen ? (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              d="M9 9H6.5A1.5 1.5 0 0 1 5 7.5V5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d="M15 9h2.5A1.5 1.5 0 0 0 19 7.5V5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d="M9 15H6.5A1.5 1.5 0 0 0 5 16.5V18.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d="M15 15h2.5A1.5 1.5 0 0 1 19 16.5V18.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              d="M5 10V7.5A1.5 1.5 0 0 1 6.5 6H9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d="M19 10V7.5A1.5 1.5 0 0 0 17.5 6H15"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d="M5 14v2.5A1.5 1.5 0 0 0 6.5 18H9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d="M19 14v2.5A1.5 1.5 0 0 1 17.5 18H15"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        )}
        </button>
      </div>
      {scrollTopUnlocked ? (
        <div className={toolbarPillShellClass}>
          <button
            type="button"
            onClick={scrollToTop}
            className="inline-flex min-h-5 items-center justify-center rounded-full px-2.5 py-0.5 font-sans text-[11px] text-zinc-400 transition hover:text-zinc-200"
          >
            Scroll to top
          </button>
        </div>
      ) : null}
    </>
  );
}

/** Storyboard: ved siden av Layout (List/Grid) i kapittelraden. */
export function StoryboardToolbarInline() {
  return (
    <div className="ml-2 flex items-center gap-1.5 sm:ml-3 sm:gap-2">
      <StoryboardToolbarButtons />
    </div>
  );
}

/** Flytende knapper (f.eks. admin storyboard). */
export function StoryboardFloatingActions() {
  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-row-reverse items-center gap-2 sm:gap-3">
      <StoryboardToolbarButtons />
    </div>
  );
}
