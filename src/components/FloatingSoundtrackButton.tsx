"use client";

import { useSoundtrack } from "@/contexts/SoundtrackContext";

export function FloatingSoundtrackButton() {
  const { isPlaying, toggle } = useSoundtrack();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isPlaying ? "Pause soundtrack" : "Play soundtrack"}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-white shadow-lg transition hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-transparent"
    >
      {isPlaying ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );
}
