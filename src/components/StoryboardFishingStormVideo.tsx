"use client";

import { ChromeVideoPlayer } from "@/components/ChromeVideoPlayer";
import { PUBLIC_FISHING_STORM_ANIMATIC } from "@/lib/public-video-paths";

/** Vis video rett etter denne PNG-rammen */
export const STORYBOARD_FISHING_STORM_AFTER = "NOH_color_00224_cropped";

export function showFishingStormVideoAfter(frameSrc: string): boolean {
  return frameSrc.includes(STORYBOARD_FISHING_STORM_AFTER);
}

function AnimaticLabel({ compact }: { compact?: boolean }) {
  return (
    <div
      className={`flex w-full shrink-0 justify-center ${compact ? "mb-1.5" : "mb-3"}`}
    >
      <p className="text-center text-xl font-medium uppercase leading-snug tracking-[0.14em] text-[#eaa631] [font-family:var(--font-im-fell-english),serif] sm:text-2xl">
        Animatic
      </p>
    </div>
  );
}

type Props = { mode: "list" | "grid" };

/**
 * List: samme bredde/ramme som ScrollFrame-bilder.
 * Grid (sm+): full bredde (2 kolonner), høyde etter video — lite luft til neste rad.
 */
export function StoryboardFishingStormVideo({ mode }: Props) {
  const player = (
    <ChromeVideoPlayer
      src={PUBLIC_FISHING_STORM_ANIMATIC}
      showFullscreen
      disablePictureInPicture
      videoClassName="block h-auto w-full cursor-pointer object-contain"
    />
  );

  if (mode === "list") {
    return (
      <article
        className="flex w-full min-w-0 flex-col"
        aria-label="Fishing storm animatics"
      >
        <AnimaticLabel />
        <div className="relative w-full overflow-visible rounded-lg bg-black shadow-[0_0_40px_-8px_rgba(0,0,0,0.08)] px-2 pb-2 pt-2 sm:px-3">
          {player}
        </div>
      </article>
    );
  }

  return (
    <div
      className="col-span-1 flex w-full min-w-0 flex-col sm:col-span-2"
      aria-label="Fishing storm animatics"
    >
      <AnimaticLabel compact />
      <div className="relative w-full overflow-visible rounded-lg bg-black shadow-[0_0_40px_-8px_rgba(0,0,0,0.08)] px-2 pb-2 pt-2 sm:px-3">
        {player}
      </div>
    </div>
  );
}
