"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ChapterJump } from "./ChapterJump";
import {
  emptyReaderProgress, parseReaderProgress, readerProgressKey, resolveReaderSection,
  type ReaderLocation, type ReaderProgress, type ReaderSection,
} from "@/lib/storyboard/reader-progress";

type ReaderElement = { section: ReaderSection; element: HTMLElement };
type TourStep = "fullscreen" | "chapters" | "bookmarks";
const SHARE_TOUR_KEY = "noh-storyboard-share-tour:v1";

const tourCopy: Record<TourStep, { label: string; title: string; description: string }> = {
  fullscreen: {
    label: "Fullscreen",
    title: "welcome",
    description: "Use Fullscreen to read without the browser around the story. Press Esc to leave fullscreen.",
  },
  chapters: {
    label: "Chapters",
    title: "move between chapters",
    description: "Open Chapters to jump directly to another part of the storyboard.",
  },
  bookmarks: {
    label: "Last read",
    title: "pick up where you left off",
    description: "Your place is saved automatically in this browser. Open Last read to return to it, update it, or remove it.",
  },
};

function currentLocation(elements: ReaderElement[]): ReaderLocation | null {
  if (elements.length === 0) return null;
  const anchor = window.innerHeight * 0.38;
  let low = 0;
  let high = elements.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (elements[middle].element.getBoundingClientRect().top <= anchor) low = middle + 1;
    else high = middle;
  }
  const { section, element } = elements[Math.max(0, low - 1)];
  const rect = element.getBoundingClientRect();
  return {
    sectionId: section.id,
    chapterId: section.chapterId,
    fraction: Math.max(0, Math.min(1, (anchor - rect.top) / Math.max(rect.height, 1))),
    savedAt: Date.now(),
  };
}

function placeLabel(section: ReaderSection) {
  return `Chapter ${String(section.chapterNumber).padStart(2, "0")} · ${section.title}`;
}

export function StoryboardReaderControls({ chapters, sections, scope, showTour = false }: {
  chapters: { id: string; title: string }[];
  sections: ReaderSection[];
  scope: string;
  showTour?: boolean;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const [progress, setProgress] = useState<ReaderProgress>(emptyReaderProgress);
  const [panelOpen, setPanelOpen] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [tourIndex, setTourIndex] = useState<number | null>(null);
  const progressRef = useRef<ReaderProgress>(emptyReaderProgress());
  const elementsRef = useRef<ReaderElement[]>([]);
  const trackingPausedRef = useRef(false);
  const tourCardRef = useRef<HTMLDivElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const key = readerProgressKey(scope);
  const tourSteps: TourStep[] = chapters.length > 1 ? ["fullscreen", "chapters", "bookmarks"] : ["fullscreen", "bookmarks"];
  const activeTourStep = tourIndex === null ? null : tourSteps[tourIndex];
  const activeTourIndex = tourIndex ?? 0;
  const lastTourStep = activeTourIndex === tourSteps.length - 1;

  const finishTour = useCallback(() => {
    try { window.localStorage.setItem(SHARE_TOUR_KEY, "done"); } catch { /* Reading positions remain available without tour persistence. */ }
    setTourIndex(null);
    window.requestAnimationFrame(() => fullscreenButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!showTour) return;
    const demoTour = new URLSearchParams(window.location.search).get("tour") === "demo";
    let seen = false;
    try { seen = window.localStorage.getItem(SHARE_TOUR_KEY) === "done"; } catch { /* Show the guide for this visit. */ }
    if (seen && !demoTour) return;
    const frame = window.requestAnimationFrame(() => {
      setPanelOpen(false);
      setTourIndex(0);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showTour]);

  useEffect(() => {
    if (tourIndex === null) return;
    const frame = window.requestAnimationFrame(() => tourCardRef.current?.querySelector<HTMLButtonElement>(".storyboard-tour-next")?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [tourIndex]);

  function handleTourKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      finishTour();
      return;
    }
    if (event.key !== "Tab") return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
    if (!buttons.length) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  const persist = useCallback((next: ReaderProgress) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
      progressRef.current = next;
      setProgress(next);
      setStorageError("");
      return true;
    } catch {
      setStorageError("This browser cannot save reading positions.");
      return false;
    }
  }, [key]);

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === document.documentElement);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    trackingPausedRef.current = false;
    elementsRef.current = sections.flatMap(section => {
      const element = document.getElementById(`section-${section.id}`);
      return element ? [{ section, element }] : [];
    });
    let loaded = emptyReaderProgress();
    let storageBlocked = false;
    try { loaded = parseReaderProgress(window.localStorage.getItem(key)); }
    catch { storageBlocked = true; }
    progressRef.current = loaded;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setProgress(loaded);
      if (storageBlocked) setStorageError("This browser cannot save reading positions.");
    });

    let frame = 0;
    let idleTimer = 0;
    let hasScrolled = false;
    let lastSavedAt = 0;
    const saveLastRead = () => {
      const location = currentLocation(elementsRef.current);
      if (location && persist({ ...progressRef.current, lastRead: location })) lastSavedAt = Date.now();
    };
    const onScroll = () => {
      trackingPausedRef.current = false;
      hasScrolled = true;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (Date.now() - lastSavedAt >= 400) saveLastRead();
        if (idleTimer) window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(() => {
          idleTimer = 0;
          if (!trackingPausedRef.current) saveLastRead();
        }, 120);
      });
    };
    const onLeave = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = 0;
      if (hasScrolled && !trackingPausedRef.current) saveLastRead();
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") onLeave(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      const updated = parseReaderProgress(event.newValue);
      progressRef.current = updated;
      setProgress(updated);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      if (frame) cancelAnimationFrame(frame);
      if (idleTimer) window.clearTimeout(idleTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [key, sections, persist]);

  async function toggleFullscreen() {
    setFullscreenError("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setFullscreenError("Fullscreen is unavailable in this browser.");
    }
  }

  function jumpTo(location: ReaderLocation) {
    const section = resolveReaderSection(location, sections);
    if (!section) return;
    const element = document.getElementById(`section-${section.id}`);
    if (!element) return;
    const fraction = section.id === location.sectionId ? location.fraction : 0;
    const rect = element.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + rect.top + rect.height * fraction - window.innerHeight * 0.38, behavior: "instant" });
    persist({ ...progressRef.current, lastRead: { sectionId: section.id, chapterId: section.chapterId, fraction, savedAt: Date.now() } });
    setPanelOpen(false);
  }

  function updateLastRead() {
    const location = currentLocation(elementsRef.current);
    if (!location) return;
    if (persist({ lastRead: location })) setFeedback("Reading position updated");
  }

  function removeLastRead() {
    trackingPausedRef.current = true;
    if (persist(emptyReaderProgress())) setFeedback("Reading position removed");
  }

  const lastReadSection = resolveReaderSection(progress.lastRead, sections);

  return (
    <div className="storyboard-reader-controls" data-tour-step={activeTourStep ?? undefined}>
      {activeTourStep && createPortal(<div className="storyboard-tour-backdrop" aria-hidden="true" />, document.body)}
      {activeTourStep && <div ref={tourCardRef} className="storyboard-tour-card" role="dialog" aria-modal="true" aria-labelledby="storyboard-tour-title" aria-describedby="storyboard-tour-description" onKeyDown={handleTourKeyDown}>
        <span className="storyboard-tour-step">{activeTourIndex + 1} / {tourSteps.length} · {tourCopy[activeTourStep].label}</span>
        <h2 id="storyboard-tour-title">{tourCopy[activeTourStep].title}</h2>
        <p id="storyboard-tour-description">{tourCopy[activeTourStep].description}</p>
        <div className="storyboard-tour-actions">
          <button type="button" className="storyboard-tour-skip" onClick={finishTour}>Skip guide</button>
          {activeTourIndex > 0 && <button type="button" onClick={() => setTourIndex(activeTourIndex - 1)}>Back</button>}
          <button type="button" className="storyboard-tour-next" onClick={() => lastTourStep ? finishTour() : setTourIndex(activeTourIndex + 1)}>{lastTourStep ? "Start reading" : "Next"}</button>
        </div>
      </div>}
      {panelOpen && <div className="storyboard-bookmark-panel" role="region" aria-label="Last read">
        {lastReadSection && progress.lastRead
          ? <button type="button" className="storyboard-bookmark-row" onClick={() => jumpTo(progress.lastRead!)} aria-label={`Return to last read: ${placeLabel(lastReadSection)}`}><span>Last read <small>{placeLabel(lastReadSection)}</small></span><span aria-hidden="true">→</span></button>
          : <div className="storyboard-bookmark-row"><span>Last read <small>No position saved yet</small></span></div>}
        <div className="storyboard-bookmark-actions"><button type="button" onClick={updateLastRead}>Update</button><button type="button" onClick={removeLastRead} disabled={!lastReadSection}>Remove</button></div>
        {feedback && <p role="status">{feedback}</p>}
        {storageError && <p role="alert">{storageError}</p>}
      </div>}
      <button type="button" className="storyboard-bookmark-button" onClick={() => { setPanelOpen(open => !open); setFeedback(""); }} aria-label="Last read" aria-expanded={panelOpen} title="Last read">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3.5h12v17l-6-4-6 4z" /></svg>
      </button>
      <button ref={fullscreenButtonRef} type="button" className="storyboard-fullscreen-button" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} aria-pressed={fullscreen}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={fullscreen ? "M4 9h5V4 M20 9h-5V4 M4 15h5v5 M20 15h-5v5" : "M9 4H4v5 M15 4h5v5 M4 15v5h5 M20 15v5h-5"} />
        </svg>
      </button>
      <ChapterJump chapters={chapters} iconOnly />
      {fullscreenError && <p className="storyboard-fullscreen-error" role="status">{fullscreenError}</p>}
    </div>
  );
}
