"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { SoundtrackProvider } from "@/contexts/SoundtrackContext";
import {
  showFishingStormVideoAfter,
  StoryboardFishingStormVideo,
} from "./StoryboardFishingStormVideo";
import { ScrollFrame } from "./ScrollFrame";
import { ChapterNav } from "./ChapterNav";
import { MainSiteHeaderLogo } from "./MainSiteHeaderLogo";
import { MainSiteMenu } from "./MainSiteMenu";
import { StoryboardToolbarInline } from "./StoryboardFloatingActions";
import { MAIN_SITE_HEADER_INNER } from "@/lib/main-site-layout";
import { ScreenplayModal } from "./storyboard/ScreenplayModal";
import type { ComicFrame } from "@/lib/comic-frames";
import { getChapterFolderFromImageSrc } from "@/lib/chapter-from-src";

type ComicScrollPageProps = {
  frames: ComicFrame[];
};

export function ComicScrollPage({ frames }: ComicScrollPageProps) {
  const chapters = buildChaptersFromFrames(frames);
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const [screenplayOpenState, setScreenplayOpenState] = useState<{
    frameText: string;
    originRect: DOMRect;
    imageSrc: string;
  } | null>(null);
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
    | { kind: "video-block"; key: string }
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

      if (showFishingStormVideoAfter(frames[i].src)) {
        gridItems.push({ kind: "video-block", key: `fishing-storm-${i}` });
        // Video: én rad, full bredde (2 kolonner). Neste frame skal starte venstre på neste rad.
        gridIndex += 2 + (gridIndex % 2);
      }
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

  const siteMenuSlot = (
    <div
      className={`${MAIN_SITE_HEADER_INNER} flex flex-wrap items-center justify-between gap-y-3 py-3`}
    >
      <MainSiteHeaderLogo />
      <div className="flex shrink-0 items-center">
        <MainSiteMenu
          homeHref="/main"
          storyboardHref="/main/storyboard"
          exploreLocationHref="/main/explore-location"
          screenplayHref="/main/screenplay"
        />
      </div>
    </div>
  );

  return (
    <SoundtrackProvider>
      <div className="min-h-screen w-full bg-black">
        <ChapterNav
          chapters={chapters}
          layout={layout}
          onLayoutChange={handleLayoutChange}
          layoutToggleOrder="list-first"
          siteMenuSlot={siteMenuSlot}
          chaptersPlacement="stickyChapters"
          logoAfterScrollY={280}
          toolbarTrailing={<StoryboardToolbarInline />}
        />

        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-stretch px-6 pb-8 pt-2 sm:px-8 sm:pb-12 md:px-12 lg:px-16">
          <div className="mx-auto mb-10 mt-6 max-w-2xl text-center sm:mb-12 sm:mt-8">
            <p className="text-[1.094rem] lowercase leading-relaxed text-zinc-400 sm:text-[1.25rem] [font-family:var(--font-im-fell-english),serif]">
              Choose a chapter and view (list or grid) in the bar above. Each frame has a screenplay
              icon — click it to open the screenplay section that matches that frame.
            </p>
          </div>

          {/* Frames with generous vertical rhythm */}
          {layout === "grid" ? (
            <div className="grid w-full grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-12 md:gap-14">
              {gridItems.map((item, idx) =>
                item.kind === "spacer" ? (
                  <div key={item.key} aria-hidden />
                ) : item.kind === "video-block" ? (
                  <StoryboardFishingStormVideo key={item.key} mode="grid" />
                ) : (
                  <ScrollFrame
                    key={item.frame.src + idx}
                    frame={item.frame}
                    frameIndex={item.index}
                    priority={item.index < 2}
                    layout={layout}
                    chapterLabel={item.chapterLabel}
                    onOpenScreenplay={(args) => setScreenplayOpenState(args)}
                  />
                )
              )}
            </div>
          ) : (
            <div className="flex w-full flex-col gap-12 sm:gap-16 md:gap-20 lg:gap-24">
              {frames.map((frame, index) => (
                <Fragment key={frame.src}>
                  <ScrollFrame
                    frame={frame}
                    frameIndex={index}
                    priority={index < 2}
                    layout={layout}
                    chapterLabel={chapterLabelByIndex[index]}
                    onOpenScreenplay={(args) => setScreenplayOpenState(args)}
                  />
                  {showFishingStormVideoAfter(frame.src) ? (
                    <StoryboardFishingStormVideo mode="list" />
                  ) : null}
                </Fragment>
              ))}
            </div>
          )}

          {/* End spacing */}
          <div className="h-16 sm:h-24" aria-hidden />

          <ScreenplayModal
            isOpen={screenplayOpenState !== null}
            frameText={screenplayOpenState?.frameText ?? ""}
            originRect={screenplayOpenState?.originRect ?? null}
            onClose={() => setScreenplayOpenState(null)}
          />
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

