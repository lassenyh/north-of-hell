"use client";

import { useRef, useState } from "react";
import type { ComicFrame } from "@/lib/comic-frames";

type ScrollFrameProps = {
  frame: ComicFrame;
  frameIndex?: number;
  priority?: boolean;
  videoSrc?: string;
  layout?: "list" | "grid";
  chapterLabel?: string;
};

/** Felles høyde over bildet i grid når kun én celle har merkelapp (én linje tekst). */
const GRID_MARKER_RESERVE = "min-h-[2.75rem]";

export function ScrollFrame({
  frame,
  frameIndex,
  priority = false,
  videoSrc,
  layout = "list",
  chapterLabel,
}: ScrollFrameProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    if (videoSrc) {
      setIsHovered(true);
      videoRef.current?.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    if (videoSrc) {
      setIsHovered(false);
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    }
  };

  const label = chapterLabel?.trim() ?? "";
  const isChapterStart = Boolean(label);
  const isGrid = layout === "grid";

  return (
    <article
      className="flex w-full min-w-0 flex-col"
      {...(typeof frameIndex === "number"
        ? { "data-frame-index": frameIndex, id: `comic-frame-${frameIndex}` }
        : {})}
    >
      {/* Kapittelmerke over bildet + scroll-anker for ChapterNav */}
      {isChapterStart && typeof frameIndex === "number" ? (
        <div
          id={`chapter-title-${frameIndex}`}
          className={`mb-3 w-full shrink-0 ${isGrid ? GRID_MARKER_RESERVE : ""}`}
        >
          <div className="inline-flex max-w-full rounded-lg border border-[#eaa631]/45 bg-zinc-950/95 px-3 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.5)] backdrop-blur-sm sm:px-3.5 sm:py-2">
            <p className="text-left text-[10px] font-medium uppercase leading-snug tracking-[0.14em] text-[#eaa631] [font-family:var(--font-im-fell-english),serif] sm:text-[11px]">
              {label}
            </p>
          </div>
        </div>
      ) : isGrid ? (
        <div
          className={`mb-3 w-full shrink-0 ${GRID_MARKER_RESERVE}`}
          aria-hidden
        />
      ) : null}

      <div
        className="relative w-full overflow-hidden rounded-lg bg-black shadow-[0_0_40px_-8px_rgba(0,0,0,0.08)]"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <img
          src={frame.src}
          alt={frame.alt}
          className={`block h-auto w-full object-contain transition-opacity duration-200 ${
            videoSrc && isHovered ? "opacity-0" : "opacity-100"
          }`}
          loading={priority ? "eager" : "lazy"}
        />
        {videoSrc && (
          <video
            ref={videoRef}
            src={videoSrc}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-200 ${
              isHovered ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            muted
            loop
            playsInline
            preload="metadata"
          />
        )}
      </div>

      {frame.manuscript ? (
        <p
          className={`mt-4 w-full text-left leading-relaxed text-white [font-family:var(--font-lora),serif] md:mt-6 ${
            layout === "grid"
              ? "text-sm sm:text-base"
              : "text-base sm:text-lg sm:leading-loose"
          }`}
        >
          {frame.manuscript}
        </p>
      ) : null}
    </article>
  );
}
