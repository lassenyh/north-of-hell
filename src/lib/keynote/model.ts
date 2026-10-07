import seed from "./seed.json";

export type Inline =
  | { type: "text"; text: string; marks?: { type: "emphasis" }[] }
  | { type: "hardBreak" };
export type RichText = {
  type: "doc";
  content: { type: "paragraph"; content?: Inline[] }[];
};
type BaseSlide = { id: string; name: string };
export type Slide = BaseSlide &
  (
    | { type: "title" }
    | { type: "video"; source: "moodfilm" }
    | {
        type: "text";
        layout: "short" | "headed";
        density?: "short" | "long";
        heading?: string;
        body: RichText;
      }
  );
export type Deck = {
  schemaVersion: 1;
  intro: { type: "title"; durationMs: 2000 };
  slides: Slide[];
  startSlideId: string;
};
export const SEED_DECK = seed as Deck;
export const PROJECT = "north-of-hell";

const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) =>
  Object.keys(v).every((k) => allowed.includes(k));
const str = (v: unknown, max: number) =>
  typeof v === "string" && v.length <= max;
export function isRichText(v: unknown): v is RichText {
  return (
    record(v) &&
    keys(v, ["type", "content"]) &&
    v.type === "doc" &&
    Array.isArray(v.content) &&
    v.content.length > 0 &&
    v.content.length <= 100 &&
    v.content.every(
      (p) =>
        record(p) &&
        keys(p, ["type", "content"]) &&
        p.type === "paragraph" &&
        (p.content === undefined ||
          (Array.isArray(p.content) &&
            p.content.length <= 2000 &&
            p.content.every(
              (n) =>
                record(n) &&
                ((n.type === "hardBreak" && keys(n, ["type"])) ||
                  (n.type === "text" &&
                    keys(n, ["type", "text", "marks"]) &&
                    str(n.text, 20000) &&
                    n.text !== "" &&
                    (n.marks === undefined ||
                      (Array.isArray(n.marks) &&
                        n.marks.length <= 1 &&
                        n.marks.every(
                          (m) =>
                            record(m) &&
                            keys(m, ["type"]) &&
                            m.type === "emphasis",
                        ))))),
            ))),
    )
  );
}
export function parseDeck(value: unknown, publish = false): Deck {
  if (
    !record(value) ||
    !keys(value, ["schemaVersion", "intro", "slides", "startSlideId"]) ||
    value.schemaVersion !== 1 ||
    !record(value.intro) ||
    !keys(value.intro, ["type", "durationMs"]) ||
    value.intro.type !== "title" ||
    value.intro.durationMs !== 2000 ||
    !str(value.startSlideId, 100) ||
    !Array.isArray(value.slides) ||
    value.slides.length > 60 ||
    JSON.stringify(value).length > 500000
  )
    throw new Error("Invalid presentation.");
  const ids = new Set<string>();
  for (const s of value.slides) {
    if (
      !record(s) ||
      typeof s.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(s.id) ||
      ids.has(s.id) ||
      !str(s.name, 120) ||
      !(s.name as string).trim()
    )
      throw new Error("Invalid slide or duplicate ID.");
    ids.add(s.id);
    if (s.type === "title" && keys(s, ["id", "name", "type"])) continue;
    if (
      s.type === "video" &&
      keys(s, ["id", "name", "type", "source"]) &&
      s.source === "moodfilm"
    )
      continue;
    if (
      s.type === "text" &&
      keys(s, ["id", "name", "type", "layout", "density", "heading", "body"]) &&
      ["short", "headed"].includes(String(s.layout)) &&
      (s.density === undefined ||
        ["short", "long"].includes(String(s.density))) &&
      (s.heading === undefined || str(s.heading, 300)) &&
      isRichText(s.body)
    )
      continue;
    throw new Error("Invalid slide content.");
  }
  if (publish && (!ids.size || !ids.has(value.startSlideId as string)))
    throw new Error(
      "Select a starting slide before publishing. The presentation cannot be empty.",
    );
  return value as Deck;
}
export function moveSlide(deck: Deck, id: string, target: number): Deck {
  const slides = [...deck.slides];
  const index = slides.findIndex((s) => s.id === id);
  if (index < 0) return deck;
  const [slide] = slides.splice(index, 1);
  slides.splice(Math.max(0, Math.min(target, slides.length)), 0, slide);
  return { ...deck, slides };
}
export function insertSlide(deck: Deck, after: string, slide: Slide): Deck {
  const slides = [...deck.slides];
  slides.splice(slides.findIndex((s) => s.id === after) + 1, 0, slide);
  return { ...deck, slides };
}
export function plainTextDoc(text: string): RichText {
  return {
    type: "doc",
    content: text
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((text) => ({
        type: "paragraph",
        ...(text ? { content: [{ type: "text", text }] } : {}),
      })),
  };
}
