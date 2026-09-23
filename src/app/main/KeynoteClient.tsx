"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { LoginDemoSwitcher } from "@/components/LoginDemoSwitcher";
import styles from "./keynote.module.css";
import { PUBLIC_KEYNOTE_FILM } from "@/lib/public-video-paths";

const filmSource = PUBLIC_KEYNOTE_FILM;
const slides = ["Title", "Logline", "Film", "Genre & Tone", "Synopsis 1", "Synopsis 2"];
const posters: Record<number, { title: string; paragraphs: string[] }> = {
  2: {
    title: "Genre & Tone",
    paragraphs: ["*A Fury Road* style chase through the true horrors\nof one of history's deadliest witch hunts – with the moral weight of *Children of Men.*"],
  },
  3: {
    title: "Synopsis",
    paragraphs: [
      "In 1662, *a series of deadly storms ravages Arctic Finnmark*, plunging its fishing villages into famine. Denmark-Norway’s King Christian IV blames *the local storm witches* and sends expeditions to the northern edge of his kingdom to find the guilty and *burn them.* Over 100 die out of a population of 3,000, one of history's most intense witch hunts per capita.",
      "Days before the last safe sailing date of the season, the expedition reaches a village hollowed out by hunger. *Three Sami sisters* are accused of causing the storms. Thrown bound into freezing water to prove their *pact with the devil*, the eldest, Siri, floats and is revealed to be eight months pregnant. By law, her execution must wait for the birth, so Thor, the expedition's *Danish headsman*, is ordered to escort her north to a Royal fort. Three years earlier, Thor broke into a mill to feed his starving, pregnant wife. A man died in the raid, and Thor was sentenced to hang for it, spared only by agreeing to become the crown's executioner in the North.\n*This escort is his ticket to freedom.*",
      "*The journey turns violent* almost immediately: their local escort, Peder, *tries to kill Siri and drown Thor at sea.* Stranded and alone, Thor and Siri are *forced inland on foot*, surviving a punishing landscape with help from a *Sami hunter.* When Siri goes into *early labor*, their small group is scattered by a search party. Thor watches Peder's men capture and beat the hunter, and is forced into an uneasy bargain with a half-drowned prisoner, Jacob, trading his help carrying the badly injured Siri for his freedom.",
    ],
  },
  4: {
    title: "Synopsis",
    paragraphs: [
      "Shelter finds them in the flipped wreck of a ship, inhabited by *Russian castaways who turn on them in the night.* Thor, Siri, and Jacob escape as the ship burns around its trapped inhabitants. Rebuilding a small boat from the wreckage, they're run down at sea and dragged to a village where Siri is imprisoned to be *forced into early labor.* Thor burns the village's food stores and *injures Peder to free her*, and the three flee by boat through a narrow archipelago as the entire village gives chase.",
      "*In a wild chase*, Siri is speared through the lung and Jacob is lost overboard. Alone with Thor on a sinking boat in open water, Siri unleashes *a massive storm* she'd secretly prepared for, *drowning their pursuers as she gives birth.* She dies in the storm's final surge, and it dies with her. Thor swims her newborn to shore.",
      "*At dawn*, walking the coastline with the child, Thor looks up to see the Royal fort emerging from the fog, and *has to decide what happens next.*",
    ],
  },
};

function Poster({ index }: { index: number }) {
  const poster = posters[index];
  return (
    <span className={`${styles.poster} ${index === 2 ? styles.genre : styles.synopsis}`}>
      <span role="heading" aria-level={2} className={styles.posterTitle}>{poster.title}</span>
      <span className={styles.posterBody}>
        {poster.paragraphs.map((paragraph, paragraphIndex) => (
          <span className={styles.posterParagraph} key={paragraphIndex}>
            {paragraph.split(/(\*[^*]+\*)/g).map((part, partIndex) =>
              part.startsWith("*") ? <em key={partIndex}>{part.slice(1, -1)}</em> : part
            )}
          </span>
        ))}
      </span>
    </span>
  );
}


function FilmPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [playError, setPlayError] = useState(false);

  async function startFilm() {
    const video = videoRef.current;
    if (!video) return;
    setPlayError(false);
    try {
      await video.play();
      video.focus({ preventScroll: true });
    } catch {
      setPlayError(true);
    }
  }

  return (
    <div className={styles.filmPlayer}>
      <video ref={videoRef} className={styles.playerVideo} src={filmSource}
        controls={started} playsInline preload="metadata" tabIndex={started ? 0 : -1}
        onPlay={() => setStarted(true)} aria-label="North of Hell film" />
      {!started && <button type="button" className={styles.playButton} onClick={startFilm} aria-label="Play North of Hell film">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
      </button>}
      {playError && <span className={styles.playError} role="status">Unable to play. Press play to try again.</span>}
    </div>
  );
}


function TitleArtwork() {
  return <span className={styles.titleArtwork}>
        <Image src="/Login-assets/NOH_TITLE_C72B1F.png" alt="North of Hell" width={7373} height={1562} priority className="h-auto w-full brightness-0" />
        <Image src="/Login-assets/NOH_FILM_BY_C72B1F.png" alt="A film by Niels Windfeldt" width={2793} height={134} priority className="mx-auto mt-[7.07%] h-auto w-[37.88%] brightness-0" />
  </span>;
}

function SlideContent({ index, preview = false }: { index: number; preview?: boolean }) {
  if (index === 0) return <TitleArtwork />;
  if (index === 2) {
    return preview
      ? <video className={styles.film} src={`${filmSource}#t=0.1`} muted playsInline preload="metadata" aria-hidden="true" />
      : <FilmPlayer />;
  }
  if (index >= 3) return <Poster index={index - 1} />;
  return (
    <p className={styles.logline}>
      <span><em>Along the arctic coast</em> of 17th-century Norway,</span>{" "}
      <span>a troubled executioner, escorting a <em>pregnant witch</em> to a royal outpost,</span>{" "}
      <span>becomes her <em>protector</em> as desperate villagers hunt them.</span>
    </p>
  );
}

export default function KeynoteClient() {
  const reducedMotion = useReducedMotion();
  const keynoteRef = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(false);
  const fullscreenHintShown = useRef(false);
  const [pulseFullscreen, setPulseFullscreen] = useState(false);
  const [demosHidden, setDemosHidden] = useState(false);
  const [active, setActive] = useState(1);
  const [suppressPreview, setSuppressPreview] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");

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
    const timer = window.setTimeout(() => setReady(true), 2000);
    return () => window.clearTimeout(timer);
  }, []);

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
      setActive((current) => Math.max(0, Math.min(slides.length - 1, current + (event.key === "ArrowRight" ? 1 : -1))));
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [ready]);

  return (
    <main ref={keynoteRef} tabIndex={-1} className={styles.keynote} aria-label="North of Hell keynote">
      <Image src="/Login-assets/RED%20BG.png" alt="" fill priority sizes="100vw" className={styles.background} />
      <div className="fixed right-4 top-4 z-50 flex items-center gap-2 sm:right-6 sm:top-6">
        <div id="keynote-login-demos" hidden={demosHidden}><LoginDemoSwitcher active="keynote" /></div>
        {ready && <button type="button" onClick={() => setDemosHidden((hidden) => !hidden)}
          aria-label={demosHidden ? "Show login demos" : "Hide login demos"}
          title={demosHidden ? "Show login demos" : "Hide login demos"}
          aria-expanded={!demosHidden} aria-controls="keynote-login-demos"
          className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/55 text-white/75 backdrop-blur-md transition hover:bg-black/75 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d={demosHidden ? "m14 6-6 6 6 6" : "m10 6 6 6-6 6"} /></svg>
        </button>}
      </div>
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
          key={active}
          onAnimationComplete={(definition) => {
            if (active === 1 && !fullscreenHintShown.current &&
              typeof definition === "object" && "opacity" in definition && definition.opacity === 1) {
              fullscreenHintShown.current = true;
              if (!reducedMotion) setPulseFullscreen(true);
            }
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: reducedMotion ? 0 : 0.65, delay: reducedMotion ? 0 : 0.3 } }}
          exit={{ opacity: 0, transition: { duration: reducedMotion ? 0 : 0.4 } }} className={`${styles.slide} ${active === 2 ? styles.filmSlide : ""}`} aria-roledescription="slide" aria-label={`${active + 1} of ${slides.length}: ${slides[active]}`}>
          <SlideContent index={active} />
        </motion.section>
        </AnimatePresence>
        <p className={styles.srOnly} aria-live="polite" aria-atomic="true">Slide {active + 1} of {slides.length}: {slides[active]}</p>
        <nav className={`${styles.controls} ${suppressPreview ? styles.suppressPreview : ""}`} onPointerMove={() => setSuppressPreview(false)} aria-label="Slide navigation">
          <div className={styles.markers}>
            {slides.map((label, index) => (
              <button key={label} type="button" className={styles.marker} aria-label={`Go to slide ${index + 1}: ${label}`} aria-current={active === index ? "step" : undefined} onClick={() => setActive(index)}>
                <span className={styles.line} />
                <span className={styles.preview} aria-hidden="true">
                  <span className={`${styles.previewCanvas} ${index === 2 ? styles.filmSlide : ""}`}><SlideContent index={index} preview /></span>
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
