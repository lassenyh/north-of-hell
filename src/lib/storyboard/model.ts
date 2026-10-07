import type { StoryboardFrame } from "@/lib/supabase/storyboard";
import { isScreenplayBlockType, legacyTextToScreenplayBlocks, type ScreenplayBlock } from "@/lib/screenplay-json";

export type Section =
  | { id: string; kind: "text"; title: string; html: string; align: "left" | "center" | "right"; size: number }
  | { id: string; kind: "screenplay"; title: string; blocks: ScreenplayBlock[] }
  | { id: string; kind: "images"; title: string; layout: "single" | "1x2" | "2x2" | "2x3" | "3x3"; images: StoryboardImage[] }
  | ComicSection;
export type StoryboardImage = { id: string; src: string; description: string; slot: number };
export type ComicBubble = {
  id: string; text: string; x: number; y: number; width: number; height: number;
  tailSide: "none" | "top" | "bottom" | "left" | "right";
  tailX: number; tailY: number; fontSize: number;
};
export type ComicSound = {
  id: string; text: string; x: number; y: number;
  fontSize: number; rotation: number; color: string;
  outlineEnabled?: boolean; outlineColor?: string; outlineWidth?: number;
};
export type ComicSection = {
  id: string; kind: "comic"; title: string; src: string; description: string;
  aspect?: "16:9" | "9:16";
  imageWidth: number; imageHeight: number; topSpace: number; bottomSpace: number;
  background: string; bubbles: ComicBubble[]; sounds: ComicSound[];
  renderedSrc?: string; renderVersion?: number;
};
export type Chapter = { id: string; title: string; sections: Section[] };
export type StoryboardDocument = { schemaVersion: 1; title: string; chapters: Chapter[] };
export type StoryboardState = {
  draft: StoryboardDocument;
  published: StoryboardDocument | null;
  draftVersion: number;
  publishedVersion: number | null;
  savedAt: string | null;
  publishedAt: string | null;
};

export const emptyDocument = (): StoryboardDocument => ({ schemaVersion: 1, title: "North of Hell · Storyboard", chapters: [] });
export const newId = () => crypto.randomUUID();
const legacyDefaultTitles: Record<string, string> = {
  "Nytt kapittel": "New chapter",
  "Ny tekstseksjon": "New text section",
  "Ny bildeseksjon": "New image section",
  "Ny manusseksjon": "New screenplay section",
};
const displayDefaultTitle = (title: string) => legacyDefaultTitles[title] ?? title;
const stableId = (value: string) => {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
};

export function importLegacyFrames(frames: StoryboardFrame[]): StoryboardDocument {
  const doc = emptyDocument();
  const chapters = new Map<string, Chapter>();
  for (const frame of frames) {
    const rawChapter = decodeURIComponent(frame.image_src.split("/")[2] || "Storyboard");
    const chapter = chapters.get(rawChapter) ?? {
      id: `legacy-chapter-${stableId(rawChapter)}`,
      title: rawChapter.replace(/^\d+\s*/, ""),
      sections: [],
    };
    if (!chapters.has(rawChapter)) chapters.set(rawChapter, chapter);
    chapter.sections.push({
      id: `legacy-section-${stableId(frame.id)}`,
      kind: "images",
      title: `Image ${chapter.sections.length + 1}`,
      layout: "single",
      images: [{ id: `legacy-image-${stableId(frame.id)}`, src: frame.image_src, description: "", slot: 0 }],
    });
    if (frame.text?.trim()) chapter.sections.push({
      id: `legacy-script-${stableId(frame.id)}`,
      kind: "screenplay",
      title: `Screenplay for image ${chapter.sections.length}`,
      blocks: legacyTextToScreenplayBlocks(frame.text),
    });
  }
  doc.chapters = [...chapters.values()];
  return doc;
}

export function parseDocument(input: unknown): StoryboardDocument {
  if (!input || typeof input !== "object") throw new Error("Invalid document.");
  const value = input as Record<string, unknown>;
  if (value.schemaVersion !== 1 || typeof value.title !== "string" || !Array.isArray(value.chapters)) throw new Error("Unknown document format.");
  const ids = new Set<string>();
  const checkId = (id: unknown) => {
    if (typeof id !== "string" || !id || id.length > 100 || ids.has(id)) throw new Error("Invalid or duplicate ID.");
    ids.add(id);
    return id;
  };
  if (value.chapters.length > 200) throw new Error("Too many chapters.");
  const chapters: Chapter[] = value.chapters.map((c) => {
    if (!c || typeof c !== "object") throw new Error("Invalid chapter.");
    const ch = c as Record<string, unknown>;
    if (typeof ch.title !== "string" || !Array.isArray(ch.sections) || ch.sections.length > 500) throw new Error("Invalid chapter content.");
    return { id: checkId(ch.id), title: displayDefaultTitle(ch.title.slice(0, 300)), sections: ch.sections.map((s) => {
      if (!s || typeof s !== "object") throw new Error("Invalid section.");
      const sec = s as Record<string, unknown>;
      const id = checkId(sec.id);
      const title = typeof sec.title === "string" ? displayDefaultTitle(sec.title.slice(0, 300)) : "Untitled";
      if (sec.kind === "text") {
        return { id, title, kind: "text" as const, html: typeof sec.html === "string" ? sec.html.slice(0, 200000) : "", align: sec.align === "center" || sec.align === "right" ? sec.align : "left", size: typeof sec.size === "number" && sec.size >= 10 && sec.size <= 48 ? sec.size : 16 };
      }
      if (sec.kind === "screenplay") {
        if (!Array.isArray(sec.blocks) || sec.blocks.length > 3000) throw new Error("Invalid screenplay.");
        return { id, title, kind: "screenplay" as const, blocks: sec.blocks.map((b: unknown) => {
          const block = b as Record<string, unknown>;
          return { type: isScreenplayBlockType(block?.type) ? block.type : "action", text: typeof block?.text === "string" ? block.text.slice(0, 10000) : "" };
        }) };
      }
      if (sec.kind === "images") {
        if (!Array.isArray(sec.images) || sec.images.length > 9) throw new Error("Invalid image gallery.");
        const layout = ["single", "1x2", "2x2", "2x3", "3x3"].includes(String(sec.layout)) ? sec.layout as "single" | "1x2" | "2x2" | "2x3" | "3x3" : "single";
        const capacity = layout === "single" ? 1 : layout === "1x2" ? 2 : layout === "2x2" ? 4 : layout === "2x3" ? 6 : 9;
        const usedSlots = new Set<number>();
        const images = sec.images.map((i: unknown, index: number) => {
          const image = i as Record<string, unknown>;
          if (typeof image?.src !== "string" || !safeImageSource(image.src)) throw new Error("Invalid image URL.");
          // Older documents used a packed array. They migrate to slots 0..n-1.
          const slot = Number.isInteger(image.slot) ? Number(image.slot) : index;
          if (slot < 0 || slot >= capacity || usedSlots.has(slot)) throw new Error("Invalid or duplicate image slot.");
          usedSlots.add(slot);
          return { id: checkId(image.id), src: image.src, description: typeof image.description === "string" ? image.description.slice(0, 10000) : "", slot };
        });
        return { id, title, kind: "images" as const, layout, images: images.sort((a, b) => a.slot - b.slot) };
      }
      if (sec.kind === "comic") {
        if (typeof sec.src !== "string" || (sec.src && !safeImageSource(sec.src))) throw new Error("Invalid comic image URL.");
        if (!Array.isArray(sec.bubbles) || sec.bubbles.length > 30) throw new Error("Invalid comic bubbles.");
        if (sec.sounds !== undefined && (!Array.isArray(sec.sounds) || sec.sounds.length > 30)) throw new Error("Invalid comic sound effects.");
        const numberIn = (input: unknown, min: number, max: number, fallback: number) =>
          typeof input === "number" && Number.isFinite(input) && input >= min && input <= max ? input : fallback;
        const background = typeof sec.background === "string" && /^#[0-9a-f]{6}$/i.test(sec.background) ? sec.background : "#000000";
        return {
          id, kind: "comic" as const, title, src: sec.src,
          description: typeof sec.description === "string" ? sec.description.slice(0, 1000) : "",
          ...(sec.aspect === "16:9" || sec.aspect === "9:16" ? { aspect: sec.aspect } : {}),
          imageWidth: numberIn(sec.imageWidth, 1, 30000, 800), imageHeight: numberIn(sec.imageHeight, 1, 30000, 450),
          topSpace: numberIn(sec.topSpace, 0, 1600, 240), bottomSpace: numberIn(sec.bottomSpace, 0, 1600, 240),
          background,
          bubbles: sec.bubbles.map((raw: unknown) => {
            if (!raw || typeof raw !== "object") throw new Error("Invalid comic bubble.");
            const bubble = raw as Record<string, unknown>;
            return {
              id: checkId(bubble.id), text: typeof bubble.text === "string" ? bubble.text.slice(0, 1500) : "",
              x: numberIn(bubble.x, 0, 800, 150), y: numberIn(bubble.y, 0, 8000, 30),
              width: numberIn(bubble.width, 100, 760, 440), height: numberIn(bubble.height, 70, 600, 170),
              tailSide: ["none", "top", "bottom", "left", "right"].includes(String(bubble.tailSide)) ? bubble.tailSide as ComicBubble["tailSide"] : "bottom",
              tailX: numberIn(bubble.tailX, 0, 800, 390), tailY: numberIn(bubble.tailY, 0, 8000, 260),
              fontSize: numberIn(bubble.fontSize, 18, 64, 34),
            };
          }),
          sounds: (Array.isArray(sec.sounds) ? sec.sounds : []).map((raw: unknown) => {
            if (!raw || typeof raw !== "object") throw new Error("Invalid comic sound effect.");
            const sound = raw as Record<string, unknown>;
            return {
              id: checkId(sound.id), text: typeof sound.text === "string" ? sound.text.slice(0, 100) : "",
              x: numberIn(sound.x, 0, 800, 400), y: numberIn(sound.y, 0, 8000, 100),
              fontSize: numberIn(sound.fontSize, 24, 180, 72), rotation: numberIn(sound.rotation, -180, 180, 0),
              color: typeof sound.color === "string" && /^#[0-9a-f]{6}$/i.test(sound.color) ? sound.color : "#171412",
              ...(sound.outlineEnabled !== undefined ? { outlineEnabled: sound.outlineEnabled === true } : {}),
              ...(sound.outlineColor !== undefined ? { outlineColor: typeof sound.outlineColor === "string" && /^#[0-9a-f]{6}$/i.test(sound.outlineColor) ? sound.outlineColor : "#ffffff" } : {}),
              ...(sound.outlineWidth !== undefined ? { outlineWidth: numberIn(sound.outlineWidth, 1, 16, 4) } : {}),
            };
          }),
          ...(typeof sec.renderedSrc === "string" && safeImageSource(sec.renderedSrc) ? { renderedSrc: sec.renderedSrc } : {}),
          ...(typeof sec.renderVersion === "number" && Number.isInteger(sec.renderVersion) && sec.renderVersion >= 1 && sec.renderVersion <= 100 ? { renderVersion: sec.renderVersion } : {}),
        };
      }
      throw new Error("Unknown section type.");
    }) };
  });
  return { schemaVersion: 1, title: value.title.slice(0, 300), chapters };
}

export function safeImageSource(src: string) {
  return src.startsWith("/") && !src.startsWith("//") && !src.includes("..") || /^https:\/\/[a-z0-9.-]+\.(?:supabase\.co|public\.blob\.vercel-storage\.com)\//i.test(src);
}

export function duplicateSection(section: Section): Section {
  if (section.kind === "images") return { ...section, id: newId(), title: `${section.title} (copy)`, images: section.images.map(image => ({ ...image, id: newId() })) };
  if (section.kind === "comic") return { ...section, id: newId(), title: `${section.title} (copy)`, bubbles: section.bubbles.map(bubble => ({ ...bubble, id: newId() })), sounds: section.sounds.map(sound => ({ ...sound, id: newId() })), renderedSrc: undefined, renderVersion: undefined };
  return { ...section, id: newId(), title: `${section.title} (copy)` };
}

export function putImageInSlot(section: Extract<Section, { kind: "images" }>, slot: number, src: string) {
  const existing = section.images.find(image => image.slot === slot);
  if (existing) existing.src = src;
  else section.images.push({ id: newId(), src, description: "", slot });
  section.images.sort((a, b) => a.slot - b.slot);
}

export function moveImageToSlot(section: Extract<Section, { kind: "images" }>, imageId: string, targetSlot: number) {
  const image = section.images.find(item => item.id === imageId);
  if (!image || image.slot === targetSlot) return;
  const target = section.images.find(item => item.slot === targetSlot);
  if (target) target.slot = image.slot;
  image.slot = targetSlot;
  section.images.sort((a, b) => a.slot - b.slot);
}
export function duplicateChapter(chapter: Chapter): Chapter {
  return { id: newId(), title: `${chapter.title} (copy)`, sections: chapter.sections.map(duplicateSection) };
}
