"use client";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { LoginDemoSwitcher } from "@/components/LoginDemoSwitcher";
import { SlideCanvas } from "@/components/keynote/SlideCanvas";
import { SlideView, TitleArtwork } from "@/components/keynote/SlideView";
import { SEED_DECK, type Deck } from "@/lib/keynote/model";
import styles from "./keynote.module.css";

export default function KeynoteClient({ deck = SEED_DECK, preview = false }: { deck?: Deck; preview?: boolean }) {
  const slides = deck.slides;
  const reducedMotion = useReducedMotion();
  const keynoteRef = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(false);
  const fullscreenHintShown = useRef(false);
  const [pulseFullscreen, setPulseFullscreen] = useState(false);
  const [demosHidden, setDemosHidden] = useState(false);
  const [activeId, setActiveId] = useState(deck.startSlideId);
  const [suppressPreview, setSuppressPreview] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");

  const active = Math.max(0, slides.findIndex((slide) => slide.id === activeId));
  const setActive = (index: number) => setActiveId(slides[index].id);

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === keynoteRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  async function toggleFullscreen() {
    setFullscreenError("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await keynoteRef.current?.requestFullscreen();
    } catch {
      setFullscreenError("Fullscreen is unavailable in this browser.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), deck.intro.durationMs);
    return () => window.clearTimeout(timer);
  }, [deck.intro.durationMs]);

  useEffect(() => {
    if (!ready) return;
    keynoteRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.altKey || event.ctrlKey || event.metaKey ||
        (target instanceof HTMLElement && (target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(target.tagName)))) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      event.stopPropagation();
      setSuppressPreview(true);
      keynoteRef.current?.focus({ preventScroll: true });
      setActiveId((current) => slides[Math.max(0, Math.min(slides.length - 1, slides.findIndex(s => s.id === current) + (event.key === "ArrowRight" ? 1 : -1)))].id);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [ready, slides]);

  return (
    <main ref={keynoteRef} tabIndex={-1} className={styles.keynote} aria-label="North of Hell keynote">
      <Image src="/Login-assets/RED%20BG.png" alt="" fill priority sizes="100vw" className={styles.background} />
      {!preview && <div className="fixed right-4 top-4 z-50 flex items-center gap-2 sm:right-6 sm:top-6">
        <div id="keynote-login-demos" hidden={demosHidden}><LoginDemoSwitcher active="keynote" /></div>
        {ready && <button type="button" onClick={() => setDemosHidden((hidden) => !hidden)}
          aria-label={demosHidden ? "Show login demos" : "Hide login demos"}
          title={demosHidden ? "Show login demos" : "Hide login demos"}
          aria-expanded={!demosHidden} aria-controls="keynote-login-demos"
          className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/55 text-white/75 backdrop-blur-md transition hover:bg-black/75 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d={demosHidden ? "m14 6-6 6 6 6" : "m10 6 6 6-6 6"} /></svg>
        </button>}
      </div>}
      <div className={`${styles.title} ${ready ? styles.titleHidden : ""}`} aria-hidden={ready}>
        <TitleArtwork />
      </div>
      {ready && <button type="button" className={`${styles.fullscreenButton} ${styles.fullscreenEnter} ${pulseFullscreen ? styles.fullscreenPulse : ""}`} onClick={toggleFullscreen}
        aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} aria-pressed={fullscreen}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={fullscreen ? "M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5" : "M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"} />
        </svg>
      </button>}
      {fullscreenError && <p className={styles.fullscreenError} role="status">{fullscreenError}</p>}
      {ready && <>
        <AnimatePresence mode="wait">
        <motion.section
          key={activeId}
          onAnimationComplete={(definition) => {
            if (activeId === deck.startSlideId && !fullscreenHintShown.current &&
              typeof definition === "object" && "opacity" in definition && definition.opacity === 1) {
              fullscreenHintShown.current = true;
              if (!reducedMotion) setPulseFullscreen(true);
            }
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: reducedMotion ? 0 : 0.65, delay: reducedMotion ? 0 : 0.3 } }}
          exit={{ opacity: 0, transition: { duration: reducedMotion ? 0 : 0.4 } }} className={`${styles.slide} ${slides[active].type === "video" ? styles.filmSlide : ""}`} aria-roledescription="slide" aria-label={`${active + 1} of ${slides.length}: ${slides[active].name}`}>
          <SlideView slide={slides[active]} />
        </motion.section>
        </AnimatePresence>
        <p className={styles.srOnly} aria-live="polite" aria-atomic="true">Slide {active + 1} of {slides.length}: {slides[active].name}</p>
        <nav className={`${styles.controls} ${suppressPreview ? styles.suppressPreview : ""}`} onPointerMove={() => setSuppressPreview(false)} aria-label="Slide navigation">
          <div className={styles.markers}>
            {slides.map((slide, index) => (
              <button key={slide.id} type="button" className={styles.marker} aria-label={`Go to slide ${index + 1}: ${slide.name}`} aria-current={active === index ? "step" : undefined} onClick={() => setActive(index)}>
                <span className={styles.line} />
                <span className={styles.preview} aria-hidden="true">
                  <span className={styles.previewCanvas}><SlideCanvas slide={slide} thumbnail /></span>
                </span>
              </button>
            ))}
          </div>
          <div className={styles.transport}>
            <button type="button" aria-label="Previous slide" disabled={active === 0} onClick={() => setActive(active - 1)}>‹</button>
            <span>{active + 1} / {slides.length}</span>
            <button type="button" aria-label="Next slide" disabled={active === slides.length - 1} onClick={() => setActive(active + 1)}>›</button>
          </div>
        </nav>
      </>}
    </main>
  );
}
