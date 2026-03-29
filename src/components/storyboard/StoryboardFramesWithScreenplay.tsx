"use client";

import { useState } from "react";
import type { StoryboardFrame as StoryboardFrameType } from "@/lib/supabase/storyboard";
import { StoryboardFrame } from "./StoryboardFrame";
import { ScreenplayModal } from "./ScreenplayModal";

type StoryboardFramesWithScreenplayProps = {
  frames: StoryboardFrameType[];
};

type OpenState = {
  frameText: string;
  originRect: DOMRect;
  imageSrc: string;
} | null;

export function StoryboardFramesWithScreenplay({
  frames,
}: StoryboardFramesWithScreenplayProps) {
  const [openState, setOpenState] = useState<OpenState>(null);

  return (
    <>
      <div className="flex flex-col gap-12 sm:gap-16">
        {frames.map((frame, index) => (
          <StoryboardFrame
            key={frame.id}
            index={index}
            imageSrc={frame.image_src}
            text={frame.text}
            onOpenScreenplay={(nextState) => setOpenState(nextState)}
          />
        ))}
      </div>

      <ScreenplayModal
        isOpen={openState !== null}
        frameText={openState?.frameText ?? ""}
        originRect={openState?.originRect ?? null}
        onClose={() => setOpenState(null)}
      />
    </>
  );
}
