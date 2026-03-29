"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function PlayPauseIcon({ playing }: { playing: boolean }) {
  if (playing) {
    return (
      <svg className="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
      </svg>
    );
  }
  return (
    <svg className="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function SpeakerIcon({ muted, low }: { muted: boolean; low: boolean }) {
  if (muted) {
    return (
      <svg className="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
      </svg>
    );
  }
  if (low) {
    return (
      <svg className="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M7 9v6h4l5 5V4l-5 5H7zm8 .5v7.08L12.59 15H9v-6h3.59L15 9.5z" />
      </svg>
    );
  }
  return (
    <svg className="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  );
}

function FullscreenIcon({ exit }: { exit: boolean }) {
  if (exit) {
    return (
      <svg className="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
      </svg>
    );
  }
  return (
    <svg className="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
    </svg>
  );
}

const btnClass =
  "flex size-[27px] shrink-0 items-center justify-center rounded-md border border-transparent bg-transparent text-zinc-300 transition hover:border-zinc-500/80 hover:bg-zinc-900/90 hover:text-white hover:backdrop-blur-sm hover:border-[#eaa631]/60";

export type ChromeVideoPlayerProps = {
  src: string;
  videoClassName: string;
  /** Storyboard animatic: skjul PiP */
  disablePictureInPicture?: boolean;
  /** Explore location: fullscreen-knapp */
  showFullscreen?: boolean;
};

export function ChromeVideoPlayer({
  src,
  videoClassName,
  disablePictureInPicture = false,
  showFullscreen = false,
}: ChromeVideoPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const volumeBeforeMute = useRef(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [shellEngaged, setShellEngaged] = useState(false);
  const suppressShowUntil = useRef(0);
  const idleHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextVideoToggle = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const clearIdleHide = () => {
    if (idleHideTimer.current) {
      clearTimeout(idleHideTimer.current);
      idleHideTimer.current = null;
    }
  };

  const scheduleIdleHide = () => {
    clearIdleHide();
    idleHideTimer.current = setTimeout(() => {
      idleHideTimer.current = null;
      const v = ref.current;
      if (v && !v.paused) setShellEngaged(false);
    }, 2000);
  };

  const syncFullscreen = useCallback(() => {
    const el = containerRef.current;
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
    };
    const fs =
      document.fullscreenElement === el ||
      doc.webkitFullscreenElement === el;
    setIsFullscreen(!!fs);
  }, []);

  useEffect(() => {
    return () => clearIdleHide();
  }, []);

  useEffect(() => {
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener(
        "webkitfullscreenchange",
        syncFullscreen as EventListener
      );
    };
  }, [syncFullscreen]);

  useEffect(() => {
    if (playing) {
      setShellEngaged(false);
      clearIdleHide();
      suppressShowUntil.current = Date.now() + 400;
    } else {
      skipNextVideoToggle.current = false;
      clearIdleHide();
    }
  }, [playing]);

  const showControlsOverlay = !playing || shellEngaged;
  /** Samme som skjult overlay under avspilling: skjul musepeker */
  const hideCursor = playing && !shellEngaged;
  const shellEngagedRef = useRef(shellEngaged);
  shellEngagedRef.current = shellEngaged;

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.volume = volume;
    const onTime = () => {
      if (!seeking) setCurrent(v.currentTime);
    };
    const setDur = () => {
      const d = v.duration;
      if (Number.isFinite(d)) setDuration(d);
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", setDur);
    v.addEventListener("durationchange", setDur);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", setDur);
      v.removeEventListener("durationchange", setDur);
    };
  }, [seeking]);

  const togglePlay = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
    } else {
      v.pause();
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = ref.current;
    if (!v) return;
    if (muted || v.muted) {
      const restore = volumeBeforeMute.current || 0.5;
      setMuted(false);
      v.muted = false;
      v.volume = restore;
      setVolume(restore);
    } else {
      volumeBeforeMute.current = v.volume > 0 ? v.volume : volumeBeforeMute.current;
      setMuted(true);
      v.muted = true;
    }
  };

  const onVolumeChange = (x: number) => {
    const v = ref.current;
    if (!v) return;
    setVolume(x);
    v.volume = x;
    if (x > 0) {
      v.muted = false;
      setMuted(false);
      volumeBeforeMute.current = x;
    }
  };

  const toggleFullscreen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    try {
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
        webkitExitFullscreen?: () => Promise<void>;
      };
      const fsEl =
        document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      if (fsEl === el) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else await doc.webkitExitFullscreen?.();
      } else {
        const req =
          el.requestFullscreen?.bind(el) ??
          (el as HTMLElement & { webkitRequestFullscreen?: () => void })
            .webkitRequestFullscreen?.bind(el);
        if (req) await req();
      }
    } catch {
      /* ignore */
    }
  };

  const dur = duration || 0;

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-visible ${
        isFullscreen
          ? "flex h-full min-h-[100dvh] w-full items-center justify-center bg-black"
          : ""
      } ${hideCursor ? "cursor-none" : ""}`}
      onMouseMove={() => {
        const v = ref.current;
        if (!v || v.paused || Date.now() < suppressShowUntil.current) return;
        setShellEngaged(true);
        scheduleIdleHide();
      }}
      onMouseLeave={() => {
        clearIdleHide();
        if (ref.current && !ref.current.paused) setShellEngaged(false);
      }}
      onTouchMove={() => {
        if (ref.current?.paused || !shellEngagedRef.current) return;
        scheduleIdleHide();
      }}
    >
      <video
        ref={ref}
        src={src}
        playsInline
        preload="metadata"
        disablePictureInPicture={disablePictureInPicture}
        className={`relative z-0 ${videoClassName} ${
          isFullscreen ? "max-h-[100dvh] max-w-full object-contain" : ""
        } ${hideCursor ? "!cursor-none" : ""}`}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTouchStart={() => {
          const v = ref.current;
          if (!v || v.paused || shellEngagedRef.current) return;
          setShellEngaged(true);
          scheduleIdleHide();
          skipNextVideoToggle.current = true;
        }}
        onClick={() => {
          if (skipNextVideoToggle.current) {
            skipNextVideoToggle.current = false;
            return;
          }
          togglePlay();
        }}
        onVolumeChange={() => {
          const v = ref.current;
          if (v) {
            setMuted(v.muted);
            if (!v.muted) setVolume(v.volume);
          }
        }}
      />
      <div
        className={`pointer-events-none absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/25 to-transparent px-2 pb-2 pt-16 transition-opacity duration-[400ms] sm:px-3 sm:pb-3 ${
          showControlsOverlay ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden={!showControlsOverlay}
      >
        <div
          className={`flex w-full flex-col items-stretch justify-end ${showControlsOverlay ? "pointer-events-auto" : ""}`}
        >
          <div className="flex h-[27px] w-full min-w-0 items-center gap-2 pb-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className={btnClass}
              aria-label={playing ? "Pause" : "Play"}
            >
              <PlayPauseIcon playing={playing} />
            </button>
            <span className="shrink-0 font-mono text-[10px] text-zinc-400 tabular-nums">
              {formatTime(current)}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(dur, 0.01)}
              step={0.25}
              value={Math.min(current, Math.max(dur, 0.01))}
              disabled={!Number.isFinite(dur) || dur <= 0}
              onMouseDown={() => setSeeking(true)}
              onMouseUp={() => setSeeking(false)}
              onMouseLeave={() => setSeeking(false)}
              onTouchStart={() => setSeeking(true)}
              onTouchEnd={() => setSeeking(false)}
              onInput={(e) => {
                const t = Number((e.target as HTMLInputElement).value);
                setCurrent(t);
                if (ref.current) ref.current.currentTime = t;
              }}
              className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[#eaa631] disabled:opacity-40"
            />
            <span className="shrink-0 font-mono text-[10px] text-zinc-400 tabular-nums">
              {formatTime(dur)}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="group relative flex size-[27px] shrink-0 items-center justify-center">
                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 flex -translate-x-1/2 flex-col items-center pb-0 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                  <div className="rounded-lg border border-zinc-600 bg-zinc-950/98 px-2 py-3 shadow-lg">
                    <div className="flex h-[104px] w-7 items-center justify-center">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={Math.round((muted ? 0 : volume) * 100)}
                        onChange={(e) => {
                          const x = Number(e.target.value) / 100;
                          onVolumeChange(x);
                        }}
                        className="h-1.5 w-[5.5rem] min-w-[5.5rem] cursor-pointer accent-[#eaa631]"
                        style={{ transform: "rotate(-90deg)" }}
                        aria-label="Volume"
                      />
                    </div>
                  </div>
                  <div className="h-1 w-full" aria-hidden />
                </div>
                <button
                  type="button"
                  onClick={toggleMute}
                  className={btnClass}
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  <SpeakerIcon muted={muted} low={!muted && volume < 0.35} />
                </button>
              </div>
              {showFullscreen ? (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className={btnClass}
                  aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  <FullscreenIcon exit={isFullscreen} />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
