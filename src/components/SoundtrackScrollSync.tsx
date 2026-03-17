"use client";

import { useEffect, useRef } from "react";
import { useSoundtrack } from "@/contexts/SoundtrackContext";

const FRAME_7_INDEX = 6; // NOH_color_00007 (0-based index 6)
const FRAME_8_INDEX = 7; // NOH_color_00008 (0-based index 7)
const FRAME_8_SEEK_MINUTES = 28;
const SEEK_FRAME_7_SECONDS = 0;
const SEEK_FRAME_8_SECONDS = FRAME_8_SEEK_MINUTES * 60;

export function SoundtrackScrollSync() {
  const { seek } = useSoundtrack();
  const hasPassedFrame8Ref = useRef(false);
  const hasSeekedToStartRef = useRef(false);

  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    let cancelled = false;

    const tryConnect = () => {
      if (cancelled) return;
      const frame7 = document.getElementById(`comic-frame-${FRAME_7_INDEX}`);
      const frame8 = document.getElementById(`comic-frame-${FRAME_8_INDEX}`);
      if (!frame7 && !frame8) return false;

      observer = new IntersectionObserver(
        (entries) => {
          if (cancelled) return;
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const target = entry.target as HTMLElement;

            // Prioriter ramme 7 når begge er synlige (typisk ved scroll oppover)
            if (target.id === `comic-frame-${FRAME_7_INDEX}` && hasPassedFrame8Ref.current) {
              if (!hasSeekedToStartRef.current) {
                seek(SEEK_FRAME_7_SECONDS);
                hasSeekedToStartRef.current = true;
              }
              continue;
            }

            if (target.id === `comic-frame-${FRAME_8_INDEX}`) {
              if (!hasPassedFrame8Ref.current) {
                hasPassedFrame8Ref.current = true;
                hasSeekedToStartRef.current = false;
              }
              seek(SEEK_FRAME_8_SECONDS);
            }
          }
        },
        { threshold: 0.1, rootMargin: "50px 0px" }
      );
      if (frame7) observer.observe(frame7);
      if (frame8) observer.observe(frame8);
      return true;
    };

    if (!tryConnect()) {
      const intervalId = window.setInterval(() => {
        if (tryConnect()) {
          window.clearInterval(intervalId);
        }
      }, 100);
      const timeoutId = window.setTimeout(() => window.clearInterval(intervalId), 5000);

      return () => {
        cancelled = true;
        window.clearInterval(intervalId);
        window.clearTimeout(timeoutId);
        observer?.disconnect();
      };
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [seek]);

  return null;
}
