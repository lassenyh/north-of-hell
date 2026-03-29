"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { INTRO_FILM_FALLBACK_SRC, INTRO_FILM_SRC } from "@/lib/intro-film";

const VIDEO_FADE_IN_MS = 1000;
const OVERLAY_FADE_OUT_MS = 700;
const CURSOR_IDLE_HIDE_MS = 2200;

type Props = {
  filmSrc?: string;
  /** Called when the film finishes playing. */
  onFilmEnd?: () => void;
  className?: string;
};

export function IntroFilmExperience({
  filmSrc = INTRO_FILM_SRC,
  onFilmEnd,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const exploreGate = useRef(false);
  const exploreDelayRef = useRef<number | undefined>(undefined);
  const playAfterExploreRef = useRef<number | undefined>(undefined);
  const exploreCommittedRef = useRef(false);
  const [activeSrc, setActiveSrc] = useState(filmSrc);
  const [videoReveal, setVideoReveal] = useState(false);
  const [showExplore, setShowExplore] = useState(false);
  const [introDismissed, setIntroDismissed] = useState(false);
  const [playbackStarted, setPlaybackStarted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const cursorIdleRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setActiveSrc(filmSrc);
  }, [filmSrc]);

  useEffect(() => {
    const sync = () => {
      setIsFullscreen(document.fullscreenElement != null);
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const beginIntroSequence = useCallback(() => {
    if (exploreGate.current) return;
    exploreGate.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVideoReveal(true));
    });
    exploreDelayRef.current = window.setTimeout(() => {
      setShowExplore(true);
    }, VIDEO_FADE_IN_MS);
  }, []);

  const resetIntroGate = useCallback(() => {
    exploreGate.current = false;
    if (exploreDelayRef.current !== undefined) {
      window.clearTimeout(exploreDelayRef.current);
      exploreDelayRef.current = undefined;
    }
    setVideoReveal(false);
    setShowExplore(false);
  }, []);

  const handleMediaReady = useCallback(() => {
    beginIntroSequence();
  }, [beginIntroSequence]);

  const handleVideoError = useCallback(() => {
    if (activeSrc === INTRO_FILM_FALLBACK_SRC) {
      beginIntroSequence();
      return;
    }
    resetIntroGate();
    setActiveSrc(INTRO_FILM_FALLBACK_SRC);
  }, [activeSrc, beginIntroSequence, resetIntroGate]);

  useEffect(() => {
    return () => {
      if (exploreDelayRef.current !== undefined) {
        window.clearTimeout(exploreDelayRef.current);
      }
      if (playAfterExploreRef.current !== undefined) {
        window.clearTimeout(playAfterExploreRef.current);
      }
      if (cursorIdleRef.current !== undefined) {
        window.clearTimeout(cursorIdleRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!playbackStarted || !isVideoPlaying) {
      setCursorVisible(true);
      if (cursorIdleRef.current !== undefined) {
        window.clearTimeout(cursorIdleRef.current);
        cursorIdleRef.current = undefined;
      }
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    const scheduleHide = () => {
      if (cursorIdleRef.current !== undefined) {
        window.clearTimeout(cursorIdleRef.current);
      }
      cursorIdleRef.current = window.setTimeout(() => {
        cursorIdleRef.current = undefined;
        setCursorVisible(false);
      }, CURSOR_IDLE_HIDE_MS);
    };

    const onActivity = () => {
      setCursorVisible(true);
      scheduleHide();
    };

    scheduleHide();
    el.addEventListener("mousemove", onActivity);
    el.addEventListener("mousedown", onActivity);
    return () => {
      el.removeEventListener("mousemove", onActivity);
      el.removeEventListener("mousedown", onActivity);
      if (cursorIdleRef.current !== undefined) {
        window.clearTimeout(cursorIdleRef.current);
        cursorIdleRef.current = undefined;
      }
    };
  }, [playbackStarted, isVideoPlaying]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.readyState >= 3) {
      handleMediaReady();
    }
  }, [activeSrc, handleMediaReady]);

  const handleExplore = useCallback(() => {
    const v = videoRef.current;
    if (!v || exploreCommittedRef.current) return;
    exploreCommittedRef.current = true;
    setIntroDismissed(true);
    if (playAfterExploreRef.current !== undefined) {
      window.clearTimeout(playAfterExploreRef.current);
    }
    playAfterExploreRef.current = window.setTimeout(() => {
      playAfterExploreRef.current = undefined;
      void v
        .play()
        .then(() => setPlaybackStarted(true))
        .catch(() => {
          exploreCommittedRef.current = false;
          setIntroDismissed(false);
        });
    }, OVERLAY_FADE_OUT_MS);
  }, []);

  const handleVideoClick = useCallback(() => {
    const v = videoRef.current;
    if (!v || !playbackStarted) return;
    if (v.paused) {
      void v.play();
    } else {
      v.pause();
    }
  }, [playbackStarted]);

  const handleEnded = useCallback(() => {
    onFilmEnd?.();
  }, [onFilmEnd]);

  const handleFullscreenClick = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void>;
    };
    const el = root as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };

    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        void document.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        void doc.webkitExitFullscreen();
      }
      return;
    }

    if (root.requestFullscreen) {
      void root.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      void el.webkitRequestFullscreen().catch(() => {});
    }
  }, []);

  const controlsInteractive = showExplore && !introDismissed;

  const cursorClass =
    playbackStarted && isVideoPlaying && !cursorVisible
      ? "cursor-none"
      : playbackStarted
        ? "cursor-pointer"
        : "";

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[200] bg-black ${cursorClass} ${className ?? ""}`}
      role="presentation"
    >
      <video
        key={activeSrc}
        ref={videoRef}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity ease-out ${
          videoReveal ? "opacity-100" : "opacity-0"
        }`}
        style={{ transitionDuration: `${VIDEO_FADE_IN_MS}ms` }}
        src={activeSrc}
        playsInline
        preload="auto"
        onLoadedData={handleMediaReady}
        onCanPlay={handleMediaReady}
        onError={handleVideoError}
        onPlay={() => setIsVideoPlaying(true)}
        onPause={() => setIsVideoPlaying(false)}
        onEnded={handleEnded}
        onClick={handleVideoClick}
      />

      <div
        className={`absolute inset-0 bg-black/60 transition-opacity ease-out ${
          introDismissed ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        style={{ transitionDuration: `${OVERLAY_FADE_OUT_MS}ms` }}
        aria-hidden
      />

      <div
        className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-5 transition-opacity ease-out ${
          showExplore && !introDismissed ? "opacity-100" : "opacity-0"
        }`}
        style={{ transitionDuration: `${VIDEO_FADE_IN_MS}ms` }}
      >
        <button
          type="button"
          onClick={handleFullscreenClick}
          className={`rounded-full border border-zinc-500/90 bg-black/45 px-9 py-2.5 text-sm font-medium uppercase tracking-[0.18em] text-zinc-200 backdrop-blur-sm transition hover:border-zinc-400 hover:bg-black/55 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 [font-family:var(--font-im-fell-english),serif] ${
            controlsInteractive ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          {isFullscreen ? "Exit fullscreen" : "Go fullscreen"}
        </button>
        <button
          type="button"
          onClick={handleExplore}
          className={`rounded-full border-2 border-[#eaa631]/90 bg-black/50 px-12 py-4 text-lg font-medium uppercase tracking-[0.2em] text-[#eaa631] backdrop-blur-sm transition hover:bg-[#eaa631]/15 hover:ring-2 hover:ring-[#eaa631]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#eaa631] [font-family:var(--font-im-fell-english),serif] ${
            controlsInteractive ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          explore
        </button>
      </div>
    </div>
  );
}
