 "use client";

import { useState } from "react";
import { SoundtrackProvider } from "@/contexts/SoundtrackContext";
import { ScrollFrame } from "./ScrollFrame";
import { FloatingActions } from "./FloatingActions";
import { SoundtrackScrollSync } from "./SoundtrackScrollSync";
import { ChapterNav } from "./ChapterNav";
import type { ComicFrame } from "@/lib/comic-frames";

type ComicScrollPageProps = {
  frames: ComicFrame[];
};

export function ComicScrollPage({ frames }: ComicScrollPageProps) {
  const chapters = buildChaptersFromFrames(frames);
  const [layout, setLayout] = useState<"list" | "grid">("list");

  // Finn kapittelnavn for første bilde i hvert kapittel basert på sti /storyboard/<chapter>/...
  const chapterLabelByIndex: Array<string | undefined> = frames.map(
    (frame, index) => {
      const parts = frame.src.split("/");
      const chapterRaw = parts.length > 2 ? parts[2] : "";
      if (!chapterRaw) return undefined;
      if (index === 0) return chapterRaw;
      const prevParts = frames[index - 1].src.split("/");
      const prevChapterRaw = prevParts.length > 2 ? prevParts[2] : "";
      return chapterRaw !== prevChapterRaw ? chapterRaw : undefined;
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
            onLayoutChange={setLayout}
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
    const parts = frame.src.split("/");
    // src looks like: /storyboard/01 OPENING - WATER TEST/...
    const chapterRaw = parts.length > 2 ? parts[2] : "Chapter";
    if (!map.has(chapterRaw)) {
      const id =
        "chapter-" +
        chapterRaw
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9\-]/g, "");
      map.set(chapterRaw, {
        id,
        label: chapterRaw,
        firstFrameIndex: index,
      });
    }
  });

  return Array.from(map.values());
}

