"use client";

import { useSoundtrack } from "@/contexts/SoundtrackContext";

export function SoundtrackPlayer() {
  const { isPlaying, toggle } = useSoundtrack();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isPlaying ? "Pause soundtrack" : "Play soundtrack"}
      className="mt-8 flex flex-col items-center justify-center gap-3 text-zinc-600 transition hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-transparent rounded"
    >
      {isPlaying ? (
        <>
          <PauseIcon className="h-16 w-16 sm:h-20 sm:w-20" />
          <span className="text-center text-sm uppercase tracking-wide">Pause soundtrack</span>
        </>
      ) : (
        <>
          <PlayIcon className="h-16 w-16 sm:h-20 sm:w-20" />
          <span className="text-center text-sm uppercase tracking-wide">Play soundtrack</span>
        </>
      )}
    </button>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
    </svg>
  );
}
