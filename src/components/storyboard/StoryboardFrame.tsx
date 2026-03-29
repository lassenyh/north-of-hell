"use client";

import { memo, useRef } from "react";
import { FrameScriptTrigger } from "./FrameScriptTrigger";

type StoryboardFrameProps = {
  index: number;
  imageSrc: string;
  text: string;
  onOpenScreenplay: (args: {
    frameText: string;
    originRect: DOMRect;
    imageSrc: string;
  }) => void;
};

function StoryboardFrameImpl({
  index,
  imageSrc,
  text,
  onOpenScreenplay,
}: StoryboardFrameProps) {
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const handleOpen = () => {
    const rect = imageContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    onOpenScreenplay({ frameText: text, originRect: rect, imageSrc });
  };

  return (
    <article className="flex w-full flex-col">
      <div
        ref={imageContainerRef}
        className="group relative w-full overflow-hidden rounded-lg bg-black hover:[&_.frame-script-trigger]:opacity-100"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={`Frame ${index + 1}`}
          className="block h-auto w-full object-contain"
        />
        <FrameScriptTrigger onClick={handleOpen} />
      </div>
      {text ? (
        <p className="mt-4 w-full text-left text-base leading-relaxed text-white sm:text-lg [font-family:var(--font-lora),serif]">
          {text}
        </p>
      ) : (
        <p className="mt-4 text-sm text-zinc-600">No text yet.</p>
      )}
    </article>
  );
}

export const StoryboardFrame = memo(StoryboardFrameImpl);
