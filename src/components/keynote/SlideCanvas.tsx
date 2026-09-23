"use client";
import { useEffect, useRef, useState } from "react";
import type { Slide } from "@/lib/keynote/model";
import { SlideView } from "./SlideView";
import styles from "@/app/main/keynote.module.css";
/** Render at the target viewport, then scale the whole stage, including fixed font caps.
 * A 1440×810 preview is therefore identical to the live renderer at 1440×810.
 */
export function SlideCanvas({
  slide,
  width = 1440,
  height = 810,
  thumbnail = false,
  onField,
}: {
  slide: Slide;
  width?: number;
  height?: number;
  thumbnail?: boolean;
  onField?: (field: "heading" | "body") => void;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setScale(el.clientWidth / width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);
  return (
    <span ref={host} className={styles.canvasHost}>
      <span
        className={styles.canvasStage}
        style={{ width, height, transform: `scale(${scale})` }}
      >
        <span
          className={`${styles.slide} ${slide.type === "video" ? styles.filmSlide : ""}`}
        >
          <SlideView slide={slide} thumbnail={thumbnail} onField={onField} />
        </span>
      </span>
    </span>
  );
}
