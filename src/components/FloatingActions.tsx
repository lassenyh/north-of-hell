"use client";

import { useState, useEffect } from "react";
import { useSoundtrack } from "@/contexts/SoundtrackContext";
import { FloatingSoundtrackButton } from "./FloatingSoundtrackButton";

export function FloatingActions() {
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const { formattedCurrentTime, formattedDuration, duration } = useSoundtrack();

  useEffect(() => {
    const onScroll = () => setShowScrollToTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      <p className="text-sm tabular-nums text-zinc-600" aria-live="polite">
        {formattedCurrentTime}
        {duration > 0 ? ` / ${formattedDuration}` : ""}
      </p>
      <div className="flex items-center gap-2">
        <FloatingSoundtrackButton />
      {showScrollToTop && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Scroll to top"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-white shadow-lg transition hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-transparent"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      )}
      </div>
    </div>
  );
}
