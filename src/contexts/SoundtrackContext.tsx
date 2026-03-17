"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const SOUNDTRACK_SRC =
  "/music/Prisoners%20Ambient%20-%20Music%20from%20the%20Maze%20and%20the%20Captive%20Silence%20%5B4jDWjAqjdxY%5D.mp3";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type SoundtrackContextValue = {
  isPlaying: boolean;
  toggle: () => void;
  seek: (seconds: number) => void;
  currentTime: number;
  duration: number;
  formattedCurrentTime: string;
  formattedDuration: string;
};

const SoundtrackContext = createContext<SoundtrackContextValue | null>(null);

export function SoundtrackProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }, [isPlaying]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const targetTime = Math.max(0, seconds);

    // Hvis vi allerede er omtrent der, ikke gjør noe (unngå gjentatte fades).
    if (Math.abs(audio.currentTime - targetTime) < 1) {
      return;
    }

    // If not playing, just jump without fading.
    if (audio.paused) {
      audio.currentTime = targetTime;
      setCurrentTime(audio.currentTime);
      return;
    }

    const originalVolume = audio.volume || 1;
    audio.volume = originalVolume;
    const fadeOutDuration = 250;
    const fadeInDuration = 250;
    const steps = 10;
    const fadeOutStep = originalVolume / steps;
    const fadeOutIntervalTime = fadeOutDuration / steps;
    const fadeInIntervalTime = fadeInDuration / steps;

    let fadeOutStepCount = 0;
    const fadeOutId = window.setInterval(() => {
      fadeOutStepCount += 1;
      const nextVolume = Math.max(0, originalVolume - fadeOutStep * fadeOutStepCount);
      audio.volume = nextVolume;

      if (fadeOutStepCount >= steps) {
        window.clearInterval(fadeOutId);
        audio.currentTime = targetTime;
        setCurrentTime(audio.currentTime);

        let fadeInStepCount = 0;
        const fadeInId = window.setInterval(() => {
          fadeInStepCount += 1;
          const nextFadeInVolume = Math.min(
            originalVolume,
            (originalVolume / steps) * fadeInStepCount
          );
          audio.volume = nextFadeInVolume;

          if (fadeInStepCount >= steps) {
            window.clearInterval(fadeInId);
          }
        }, fadeInIntervalTime);
      }
    }, fadeOutIntervalTime);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration);
    const onLoadedMetadata = () => setDuration(audio.duration);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    if (audio.duration && Number.isFinite(audio.duration)) setDuration(audio.duration);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, []);

  return (
    <SoundtrackContext.Provider
      value={{
        isPlaying,
        toggle,
        seek,
        currentTime,
        duration,
        formattedCurrentTime: formatTime(currentTime),
        formattedDuration: formatTime(duration),
      }}
    >
      <audio
        ref={audioRef}
        src={SOUNDTRACK_SRC}
        loop
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />
      {children}
    </SoundtrackContext.Provider>
  );
}

export function useSoundtrack() {
  const ctx = useContext(SoundtrackContext);
  if (!ctx) throw new Error("useSoundtrack must be used within SoundtrackProvider");
  return ctx;
}
