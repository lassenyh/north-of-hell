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

  return (
    <article
      className="flex w-full min-w-0 flex-col"
      {...(typeof frameIndex === "number"
        ? { "data-frame-index": frameIndex, id: `comic-frame-${frameIndex}` }
        : {})}
    >
      {layout === "grid" ? (
        // I grid-layout reserverer vi alltid samme høyde, også når det ikke er tittel,
        // slik at bildene i raden starter på samme vertikale linje.
        <h2
          className={`mb-3 mt-2 text-xs font-medium uppercase tracking-[0.18em] [font-family:var(--font-im-fell-english),serif] ${
            chapterLabel ? "text-[#eaa631] opacity-100" : "opacity-0"
          }`}
        >
          {chapterLabel || "placeholder"}
        </h2>
      ) : chapterLabel ? (
        <h2 className="mb-4 mt-2 text-xs font-medium uppercase tracking-[0.18em] text-[#eaa631] [font-family:var(--font-im-fell-english),serif]">
          {chapterLabel}
        </h2>
      ) : null}
      {/* Container now grows with the image's natural aspect ratio */}
      <div
        className="relative w-full overflow-hidden rounded-lg bg-black shadow-[0_0_40px_-8px_rgba(0,0,0,0.08)]"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <img
          src={frame.src}
          alt={frame.alt}
          className={`block w-full h-auto object-contain transition-opacity duration-200 ${
            videoSrc && isHovered ? "opacity-0" : "opacity-100"
          }`}
          loading={priority ? "eager" : "lazy"}
        />
        {videoSrc && (
          <video
            ref={videoRef}
            src={videoSrc}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-200 ${
              isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            muted
            loop
            playsInline
            preload="metadata"
          />
        )}
      </div>

      {/* Manuscript text — only render if present */}
      {frame.manuscript ? (
        <p
          className={`mt-4 w-full text-left leading-relaxed text-white md:mt-6 [font-family:var(--font-lora),serif] ${
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
