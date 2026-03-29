"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildScreenplayBlocksFromText,
  findBestScreenplayMatch,
  normalizeForMatch,
  tokenize,
  type ScreenplayBlock,
} from "@/lib/screenplay-matching";
import { ScreenplayPdfViewer } from "./ScreenplayPdfViewer";

type ScreenplayModalProps = {
  isOpen: boolean;
  frameText: string;
  originRect: DOMRect | null;
  onClose: () => void;
};

type ApiPayload = {
  rawText: string;
  blocks: Array<{ id: string; text: string; page: number }>;
};

type MatchedScreenplayBlock = ScreenplayBlock & { page: number };

export function ScreenplayModal({
  isOpen,
  frameText,
  onClose,
}: ScreenplayModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<MatchedScreenplayBlock[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    if (blocks.length > 0) return;

    const loadScreenplay = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetch("/api/screenplay", { cache: "no-store" });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(data?.error || "Failed screenplay request");
        }
        const payload = (await response.json()) as ApiPayload;

        // For V1 we rely on text matching. In a future version we can augment blocks
        // with stable anchor IDs or manual overrides to improve precision.
        const parsedBlocks =
          payload.blocks.length > 0
            ? payload.blocks.map((block) => ({
                id: block.id,
                text: block.text,
                normalizedText: normalizeForMatch(block.text),
                wordSet: new Set(tokenize(block.text)),
                page: block.page,
              }))
            : buildScreenplayBlocksFromText(payload.rawText).map((block, index) => ({
                ...block,
                page: index + 1,
              }));

        setBlocks(parsedBlocks);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load screenplay."
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadScreenplay();
  }, [isOpen, blocks.length]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const match = useMemo(() => findBestScreenplayMatch(frameText, blocks), [frameText, blocks]);
  const noConfidentMatch =
    match.matchedBlockId == null || match.reason === "fallback-top" || match.confidence < 0.4;
  const matchedPage = useMemo(() => {
    if (!match.matchedBlockId) return 1;
    const matched = blocks.find((block) => block.id === match.matchedBlockId);
    return matched?.page ?? 1;
  }, [blocks, match.matchedBlockId]);
  const matchedPageAnchor = useMemo(() => {
    if (!match.matchedBlockId) return 0;
    const matched = blocks.find((block) => block.id === match.matchedBlockId);
    if (!matched) return 0;

    const pageBlocks = blocks.filter((block) => block.page === matched.page);
    if (pageBlocks.length <= 1) return 0;

    const normalizedPageText = normalizeForMatch(pageBlocks.map((block) => block.text).join(" "));
    if (!normalizedPageText) return 0;

    const normalizedFrame = normalizeForMatch(frameText);
    const directIndex = normalizedFrame ? normalizedPageText.indexOf(normalizedFrame) : -1;
    if (directIndex >= 0) {
      const directRatio = directIndex / Math.max(1, normalizedPageText.length);
      return clampAnchor(directRatio - 0.12);
    }

    // Fallback: find the earliest 4+ token phrase from frame text that appears on page.
    const frameWords = normalizedFrame.split(" ").filter(Boolean);
    const maxWindow = Math.min(8, frameWords.length);
    for (let windowSize = maxWindow; windowSize >= 4; windowSize -= 1) {
      for (let i = 0; i <= frameWords.length - windowSize; i += 1) {
        const phrase = frameWords.slice(i, i + windowSize).join(" ");
        const idx = normalizedPageText.indexOf(phrase);
        if (idx >= 0) {
          const ratio = idx / Math.max(1, normalizedPageText.length);
          return clampAnchor(ratio - 0.12);
        }
      }
    }

    // Final fallback: block-order ratio.
    const indexOnPage = pageBlocks.findIndex((block) => block.id === matched.id);
    if (indexOnPage < 0) return 0;
    const rawRatio = indexOnPage / pageBlocks.length;
    return clampAnchor(rawRatio - 0.1);
  }, [blocks, match.matchedBlockId, frameText]);

  const targetWidth = Math.min(980, typeof window !== "undefined" ? window.innerWidth - 40 : 980);
  const targetHeight = Math.min(
    760,
    typeof window !== "undefined" ? window.innerHeight - 56 : 760
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close screenplay modal"
        className="absolute inset-0 h-full w-full cursor-default bg-black/72 backdrop-blur-[2px]"
      />

      <div
        className="relative z-[101] overflow-hidden rounded-2xl border border-white/25 bg-black/95 shadow-[0_40px_120px_rgba(0,0,0,0.75)]"
        style={{ width: targetWidth, height: targetHeight }}
      >
        <div className="flex h-full w-full flex-col">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/55 text-zinc-200 transition-colors hover:bg-black/75 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>

          <div className="min-h-0 flex-1 p-2 sm:p-3">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                Matching frame text to screenplay...
              </div>
            ) : errorMessage ? (
              <div className="flex h-full items-center justify-center text-sm text-red-300">
                {errorMessage}
              </div>
            ) : (
              <ScreenplayPdfViewer
                matchedPage={matchedPage}
                matchedPageAnchor={matchedPageAnchor}
                noConfidentMatch={noConfidentMatch}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function clampAnchor(value: number): number {
  return Math.max(0, Math.min(0.88, value));
}
