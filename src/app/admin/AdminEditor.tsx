"use client";

import { useState } from "react";
import { updateFrameText } from "./actions";
import type { StoryboardFrame } from "@/lib/supabase/storyboard";

type Props = { frames: StoryboardFrame[] };

export function AdminEditor({ frames: initialFrames }: Props) {
  const [frames, setFrames] = useState(initialFrames);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [seedStatus, setSeedStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const chapters = groupFramesByChapter(frames);
  const [activeChapterId, setActiveChapterId] = useState(
    chapters[0]?.id ?? null
  );

  const handleSave = async (frame: StoryboardFrame, text: string) => {
    setSavingId(frame.id);
    const result = await updateFrameText(frame.id, text);
    setSavingId(null);
    if (result.ok) {
      setFrames((prev) =>
        prev.map((f) => (f.id === frame.id ? { ...f, text } : f))
      );
    }
  };

  const handleSeed = async () => {
    setSeedStatus("loading");
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setSeedStatus("done");
        window.location.reload();
      } else {
        setSeedStatus("error");
      }
    } catch {
      setSeedStatus("error");
    }
  };

  if (frames.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-8 text-center">
        <p className="mb-4 text-zinc-400">No frames in the database yet.</p>
        <p className="mb-6 text-sm text-zinc-500">
          Click below to load all images from <code className="rounded bg-zinc-800 px-1">public/storyboard</code> into Supabase.
        </p>
        <button
          type="button"
          onClick={handleSeed}
          disabled={seedStatus === "loading"}
          className="rounded bg-[#eaa631] px-4 py-2 text-black font-medium disabled:opacity-50"
        >
          {seedStatus === "loading" ? "Seeding…" : "Seed database from current images"}
        </button>
        {seedStatus === "error" && (
          <p className="mt-4 text-sm text-red-400">Seed failed. Check env vars and Supabase table.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <a
          href="/storyboard"
          className="text-sm text-zinc-400 underline hover:text-zinc-200"
        >
          View public storyboard →
        </a>
        <button
          type="button"
          onClick={handleSeed}
          disabled={seedStatus === "loading"}
          className="text-sm text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
        >
          {seedStatus === "loading" ? "Seeding…" : "Re-seed from disk"}
        </button>
      </div>

      {/* Sticky kapittelmeny som følger scrollen */} 
      {chapters.length > 0 && (
        <div className="sticky top-0 z-20 mb-4 border-b border-zinc-800/70 bg-black/85 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Chapters
            </span>
            <div className="relative inline-block min-w-[220px]">
              <select
                value={activeChapterId ?? undefined}
                onChange={(e) => {
                  const id = e.target.value;
                  setActiveChapterId(id);
                  const el = document.getElementById(id);
                  if (el) {
                    el.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }
                }}
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-[#eaa631] focus:outline-none focus:ring-1 focus:ring-[#eaa631]"
              >
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-12 sm:gap-16">
        {chapters.map((chapter) => (
          <section
            key={chapter.id}
            id={chapter.id}
            className="space-y-6 scroll-mt-24"
          >
            <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">
              {chapter.label}
            </h2>
            <div className="flex flex-col gap-10">
              {chapter.frames.map((frame, index) => (
                <FrameRow
                  key={frame.id}
                  frame={frame}
                  index={index + chapter.offset}
                  saving={savingId === frame.id}
                  onSave={handleSave}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function groupFramesByChapter(frames: StoryboardFrame[]) {
  type Chapter = {
    id: string;
    label: string;
    frames: StoryboardFrame[];
    offset: number;
  };
  const chapters: Chapter[] = [];

  let current: Chapter | null = null;
  frames.forEach((frame, index) => {
    const parts = frame.image_src.split("/");
    const label = parts.length > 2 ? parts[2] : "Unsorted";

    if (!current || current.label !== label) {
      const id =
        "admin-chapter-" +
        label
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9\-]/g, "");
      current = { id, label, frames: [], offset: index };
      chapters.push(current);
    }
    current.frames.push(frame);
  });

  return chapters;
}

function FrameRow({
  frame,
  index,
  saving,
  onSave,
}: {
  frame: StoryboardFrame;
  index: number;
  saving: boolean;
  onSave: (frame: StoryboardFrame, text: string) => void;
}) {
  const [text, setText] = useState(frame.text);
  const fileName = frame.image_src.split("/").pop() ?? frame.image_src;

  return (
    <article className="flex w-full flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
      <div className="overflow-hidden rounded">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frame.image_src}
          alt={`Frame ${index + 1}`}
          className="block w-full h-auto object-contain"
        />
      </div>
      <p className="text-xs text-zinc-500">{fileName}</p>
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
          Manuscript text (frame {index + 1})
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-[#eaa631] focus:outline-none focus:ring-1 focus:ring-[#eaa631]"
          placeholder="Enter manuscript text…"
        />
        <button
          type="button"
          onClick={() => onSave(frame, text)}
          disabled={saving || text === frame.text}
          className="mt-2 rounded bg-[#eaa631] px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </article>
  );
}
