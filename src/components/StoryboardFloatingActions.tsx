"use client";

import { useEffect, useState } from "react";

const SCROLL_TOP_REVEAL_PX = 100;

export function StoryboardFloatingActions() {
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

  const scrollTopBtnClass =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-300 shadow-lg transition-all duration-200 hover:border-zinc-400 hover:text-white opacity-100";

  const fullscreenBtnClass =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-300 shadow-lg hover:border-zinc-400 hover:text-white";

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-row-reverse items-center gap-2 sm:gap-3">
      {scrollTopUnlocked ? (
        <button
          type="button"
          onClick={scrollToTop}
          className={scrollTopBtnClass}
          aria-label="Scroll to top"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              d="M12 5v14M12 5l4.5 4.5M12 5L7.5 9.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}
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
  );
}
