"use client";

import { useEffect, useState } from "react";
import { ChapterJump } from "./ChapterJump";
import { useStoryboardTheme } from "./StoryboardTheme";

export function StoryboardReaderControls({ chapters }: { chapters: { id: string; title: string }[] }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const { theme, toggleTheme } = useStoryboardTheme();

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === document.documentElement);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  async function toggleFullscreen() {
    setFullscreenError("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setFullscreenError("Fullscreen is unavailable in this browser.");
    }
  }

  return (
    <div className="storyboard-reader-controls">
      <button type="button" className="storyboard-theme-button" onClick={toggleTheme} aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"} title={theme === "light" ? "Dark mode" : "Light mode"} aria-pressed={theme === "light"}>{theme === "light" ? "☀" : "☾"}</button>
      <button
        type="button"
        className="storyboard-fullscreen-button"
        onClick={toggleFullscreen}
        aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        aria-pressed={fullscreen}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={fullscreen ? "M4 9h5V4 M20 9h-5V4 M4 15h5v5 M20 15h-5v5" : "M9 4H4v5 M15 4h5v5 M4 15v5h5 M20 15v5h-5"} />
        </svg>
      </button>
      <ChapterJump chapters={chapters} iconOnly />
      {fullscreenError && <p className="storyboard-fullscreen-error" role="status">{fullscreenError}</p>}
    </div>
  );
}
