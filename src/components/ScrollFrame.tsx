"use client";

import { useRef, useState } from "react";
import type { ComicFrame } from "@/lib/comic-frames";
import { getManuscriptDisplayLength } from "@/lib/screenplay-json";
import { ManuscriptText } from "@/components/ManuscriptText";
import { FrameScriptTrigger } from "@/components/storyboard/FrameScriptTrigger";

type ScrollFrameProps = {
  frame: ComicFrame;
  frameIndex?: number;
  priority?: boolean;
  videoSrc?: string;
  layout?: "list" | "grid";
  chapterLabel?: string;
  onOpenScreenplay?: (args: {
    frameText: string;
    originRect: DOMRect;
    imageSrc: string;
  }) => void;
};

/** Felles høyde over bildet i grid når kun én celle har merkelapp (én linje tekst). */
const GRID_MARKER_RESERVE = "min-h-[2.75rem]";

/** I grid: hvis manus overstiger denne lengden (tegn inkl. mellomrom), vis scroll. */
const GRID_SCROLL_THRESHOLD = 450;

/** Maks høyde på scroll-ruten slik at overflow slår inn; stor nok til å ligne en full rute uten scroll. */
const GRID_SCROLL_MAX_HEIGHT = "22rem";

export function ScrollFrame({
  frame,
  frameIndex,
  priority = false,
  videoSrc,
  layout = "list",
  chapterLabel,
  onOpenScreenplay,
}: ScrollFrameProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    if (videoSrc) setIsHovered(true);
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

  const handleVideoClick = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const label = chapterLabel?.trim() ?? "";
  const isChapterStart = Boolean(label);
  const isGrid = layout === "grid";
  const hasScriptPreview = Boolean(onOpenScreenplay && frame.manuscript.trim().length > 0);

  const handleOpenScreenplay = () => {
    if (!onOpenScreenplay) return;
    const rect = imageContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    onOpenScreenplay({
      frameText: frame.manuscript,
      originRect: rect,
      imageSrc: frame.src,
    });
  };

  return (
    <article
      className="flex w-full min-w-0 flex-col"
      data-layout={layout}
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
        ref={imageContainerRef}
        className="group relative w-full overflow-hidden rounded-lg bg-black shadow-[0_0_40px_-8px_rgba(0,0,0,0.08)] hover:[&_.frame-script-trigger]:opacity-100"
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
            onClick={handleVideoClick}
            className={`absolute inset-0 h-full w-full cursor-pointer object-contain transition-opacity duration-200 ${
              isHovered ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            muted
            loop
            playsInline
            preload="metadata"
          />
        )}
        {hasScriptPreview ? <FrameScriptTrigger onClick={handleOpenScreenplay} /> : null}
      </div>

      {frame.manuscript ? (
        isGrid && getManuscriptDisplayLength(frame.manuscript) > GRID_SCROLL_THRESHOLD ? (
          <div
            className="grid-manuscript-scroll mt-4 md:mt-6 overflow-y-auto overflow-x-hidden rounded-lg bg-zinc-950/70 shadow-inner text-[12pt] leading-[1.15]"
            style={{ maxHeight: GRID_SCROLL_MAX_HEIGHT }}
            aria-label="Manuskript"
          >
            <ManuscriptText text={frame.manuscript} className="px-2 py-1.5" />
          </div>
        ) : (
          <ManuscriptText text={frame.manuscript} className="mt-4 md:mt-6" />
        )
      ) : null}
    </article>
  );
}
