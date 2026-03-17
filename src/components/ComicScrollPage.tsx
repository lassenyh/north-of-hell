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

  return (
    <SoundtrackProvider>
      <div className="min-h-screen w-full bg-black">
        <FloatingActions />
        <SoundtrackScrollSync />
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-stretch pt-32 sm:pt-40 md:pt-48 pb-8 sm:pb-12 px-6 sm:px-8 md:px-12 lg:px-16">
        {/* Header */}
        <header className="mb-24 flex flex-col items-center text-center sm:mb-28">
          <h1 className="text-4xl font-medium uppercase tracking-tight text-[#eaa631] sm:text-6xl [font-family:var(--font-im-fell-english),serif]">
            North of Hell
          </h1>
          <p className="mt-3 max-w-xl text-lg text-zinc-400 sm:text-xl [font-family:var(--font-im-fell-english),serif]">
            the storm is never an accident
          </p>
        </header>

        <ChapterNav chapters={chapters} />

        {/* Frames with generous vertical rhythm */}
        <div className="mt-8 flex w-full flex-col gap-12 sm:mt-12 sm:gap-16 md:mt-16 md:gap-20 lg:gap-24">
          {frames.map((frame, index) => (
            <ScrollFrame
              key={frame.src}
              frame={frame}
              frameIndex={index}
              priority={index < 2}
            />
          ))}
        </div>

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

