"use client";

import { useEffect, useMemo, useRef } from "react";

type ViewerBlock = { id: string; text: string };

type ScreenplayViewerProps = {
  blocks: ViewerBlock[];
  matchedBlockId: string | null;
  noConfidentMatch: boolean;
};

export function ScreenplayViewer({
  blocks,
  matchedBlockId,
  noConfidentMatch,
}: ScreenplayViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const blockElements = useMemo(() => new Map<string, HTMLDivElement>(), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!matchedBlockId) {
      container.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const target = blockElements.get(matchedBlockId);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [matchedBlockId, blockElements]);

  return (
    <div className="h-full w-full">
      {noConfidentMatch ? (
        <p className="mb-3 rounded-md border border-amber-200/20 bg-amber-100/10 px-3 py-2 text-xs text-amber-100/90">
          Could not confidently match this frame to an exact screenplay position.
        </p>
      ) : null}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto rounded-lg border border-white/10 bg-zinc-950/70 px-4 py-5 sm:px-8 sm:py-7"
      >
        <div className="mx-auto w-full max-w-3xl space-y-3 [font-family:var(--font-geist-mono),ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace] text-sm leading-7 text-zinc-200">
          {blocks.map((block) => (
            <div
              key={block.id}
              ref={(node) => {
                if (node) blockElements.set(block.id, node);
                else blockElements.delete(block.id);
              }}
              className={`rounded-md px-3 py-2 transition-colors duration-700 ${
                matchedBlockId === block.id
                  ? "bg-amber-200/15 ring-1 ring-amber-200/40 animate-pulse"
                  : "bg-transparent"
              }`}
            >
              {block.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
