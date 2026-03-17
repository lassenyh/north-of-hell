"use client";

import { useEffect, useRef, useState } from "react";
import { SoundtrackProvider } from "@/contexts/SoundtrackContext";
import { ScrollFrame } from "./ScrollFrame";
import { ChapterNav } from "./ChapterNav";
import { StoryboardFloatingActions } from "./StoryboardFloatingActions";
import type { ComicFrame } from "@/lib/comic-frames";
import { getChapterFolderFromImageSrc } from "@/lib/chapter-from-src";

type ComicScrollPageProps = {
  frames: ComicFrame[];
};

export function ComicScrollPage({ frames }: ComicScrollPageProps) {
  const chapters = buildChaptersFromFrames(frames);
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const pendingScrollIndexRef = useRef<number | null>(null);

  // Finn kapittelnavn for første bilde i hvert kapittel basert på sti /storyboard/<chapter>/...
  const chapterLabelByIndex: Array<string | undefined> = frames.map(
    (frame, index) => {
      const chapterRaw = getChapterFolderFromImageSrc(frame.src);
      if (!chapterRaw) return undefined;
      if (index === 0) return chapterRaw;
      const prevRaw = getChapterFolderFromImageSrc(frames[index - 1].src);
      return chapterRaw !== prevRaw ? chapterRaw : undefined;
    }
  );

  // For gridlayout ønsker vi at første bilde i et kapittel alltid starter på venstre kolonne.
  // Da legger vi inn tomme "spacere" når et nytt kapittel ellers ville havnet i høyre kolonne.
  const gridItems: Array<
    | { kind: "frame"; frame: ComicFrame; index: number; chapterLabel?: string }
    | { kind: "spacer"; key: string }
  > = [];

  if (layout === "grid") {
    let gridIndex = 0;
    for (let i = 0; i < frames.length; i += 1) {
      const label = chapterLabelByIndex[i];
      const isChapterStart = Boolean(label);

      // Hvis dette er starten på et nytt kapittel og vi står i høyre kolonne (odd gridIndex),
      // legg inn en spacer først slik at kapittel-starten havner til venstre på neste rad.
      if (isChapterStart && gridIndex % 2 === 1) {
        gridItems.push({ kind: "spacer", key: `spacer-${i}` });
        gridIndex += 1;
      }

      gridItems.push({
        kind: "frame",
        frame: frames[i],
        index: i,
        chapterLabel: label,
      });
      gridIndex += 1;
    }
  }

  const handleLayoutChange = (nextLayout: "list" | "grid") => {
    if (nextLayout === layout) return;

    // Finn bildet som er nærmest midten av viewporten akkurat nå
    const frameEls = document.querySelectorAll<HTMLElement>("[data-frame-index]");
    if (!frameEls.length) {
      setLayout(nextLayout);
      return;
    }

    const viewportMiddle = window.scrollY + window.innerHeight / 2;
    let closestIndex: number | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    frameEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const middle = rect.top + window.scrollY + rect.height / 2;
      const distance = Math.abs(middle - viewportMiddle);
      const indexAttr = el.getAttribute("data-frame-index");
      if (indexAttr == null) return;
      const idx = Number(indexAttr);
      if (!Number.isFinite(idx)) return;

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = idx;
      }
    });

    if (closestIndex !== null) {
      pendingScrollIndexRef.current = closestIndex;
    }

    setLayout(nextLayout);
  };

  useEffect(() => {
    const index = pendingScrollIndexRef.current;
    if (index == null) return;

    pendingScrollIndexRef.current = null;

    const target =
      document.getElementById(`chapter-title-${index}`) ??
      document.getElementById(`comic-frame-${index}`);
    if (!target) return;

    const nav = document.querySelector<HTMLElement>("[data-chapter-nav=\"true\"]");
    const navHeight = nav ? nav.getBoundingClientRect().height : 0;
    const extraOffset = 20;
    const targetTop = target.getBoundingClientRect().top + window.scrollY;

    // Overstyr global `scroll-behavior: smooth` for akkurat dette hoppet
    const htmlEl = document.documentElement;
    const previousBehavior = htmlEl.style.scrollBehavior;
    htmlEl.style.scrollBehavior = "auto";
    window.scrollTo(0, targetTop - navHeight - extraOffset);
    htmlEl.style.scrollBehavior = previousBehavior;
  }, [layout]);

  return (
    <SoundtrackProvider>
      <div className="min-h-screen w-full bg-black">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-stretch pt-32 sm:pt-40 md:pt-48 pb-8 sm:pb-12 px-6 sm:px-8 md:px-12 lg:px-16">
          {/* Header */}
          <header className="mb-24 flex flex-col items-center text-center sm:mb-28">
            <p className="mb-4 text-xs lowercase tracking-[0.25em] text-zinc-500 sm:text-sm [font-family:var(--font-im-fell-english),serif]">
              a film by niels windfeldt
            </p>
            <h1 className="text-4xl font-medium uppercase tracking-tight text-[#eaa631] sm:text-6xl [font-family:var(--font-im-fell-english),serif]">
              North of Hell
            </h1>
            <p className="mt-3 max-w-xl text-lg text-zinc-400 sm:text-xl [font-family:var(--font-im-fell-english),serif]">
              the storm is never an accident
            </p>
          </header>

          <ChapterNav
            chapters={chapters}
            layout={layout}
            onLayoutChange={handleLayoutChange}
            layoutToggleOrder="list-first"
          />

          {/* Frames with generous vertical rhythm */}
          {layout === "grid" ? (
            <div className="mt-8 grid w-full grid-cols-1 gap-10 sm:mt-12 sm:grid-cols-2 sm:gap-12 md:mt-16 md:gap-14">
              {gridItems.map((item, idx) =>
                item.kind === "spacer" ? (
                  <div key={item.key} aria-hidden />
                ) : (
                  <ScrollFrame
                    key={item.frame.src + idx}
                    frame={item.frame}
                    frameIndex={item.index}
                    priority={item.index < 2}
                    layout={layout}
                    chapterLabel={item.chapterLabel}
                  />
                )
              )}
            </div>
          ) : (
            <div className="mt-8 flex w-full flex-col gap-12 sm:mt-12 sm:gap-16 md:mt-16 md:gap-20 lg:gap-24">
              {frames.map((frame, index) => (
                <ScrollFrame
                  key={frame.src}
                  frame={frame}
                  frameIndex={index}
                  priority={index < 2}
                  layout={layout}
                  chapterLabel={chapterLabelByIndex[index]}
                />
              ))}
            </div>
          )}

          {/* End spacing */}
          <div className="h-16 sm:h-24" aria-hidden />

          <StoryboardFloatingActions />
        </div>
      </div>
    </SoundtrackProvider>
  );
}

type ChapterInfo = {
  id: string;
  label: string;
  firstFrameIndex: number;
};

function buildChaptersFromFrames(frames: ComicFrame[]): ChapterInfo[] {
  const map = new Map<string, ChapterInfo>();

  frames.forEach((frame, index) => {
    const parsed = getChapterFolderFromImageSrc(frame.src);
    const chapterKey = parsed || "__default__";
    const displayLabel = parsed || "Storyboard";
    if (!map.has(chapterKey)) {
      const slug =
        chapterKey === "__default__"
          ? "main"
          : chapterKey
              .toLowerCase()
              .replace(/\s+/g, "-")
              .replace(/[^a-z0-9\-]/g, "");
      map.set(chapterKey, {
        id: `chapter-${slug}`,
        label: displayLabel,
        firstFrameIndex: index,
      });
    }
  });

  return Array.from(map.values());
}

