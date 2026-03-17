"use client";

import { useRef, useState } from "react";
import type { ComicFrame } from "@/lib/comic-frames";

type ScrollFrameProps = {
  frame: ComicFrame;
  frameIndex?: number;
  priority?: boolean;
  videoSrc?: string;
};

export function ScrollFrame({ frame, frameIndex, priority = false, videoSrc }: ScrollFrameProps) {
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
        <p className="mt-6 w-full text-left text-base leading-relaxed text-white sm:text-lg sm:leading-loose md:mt-8 [font-family:var(--font-lora),serif]">
          {frame.manuscript}
        </p>
      ) : null}
    </article>
  );
}
