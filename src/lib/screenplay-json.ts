/**
 * Screenplay data stored in Supabase `frame.text` as JSON string:
 * [
 *   { "type": "scene_heading", "text": "INT. CABIN - NIGHT" },
 *   { "type": "action", "text": "..." },
 *   { "type": "character", "text": "ERIK" },
 *   { "type": "parenthetical", "text": "(quietly)" },
 *   { "type": "dialogue", "text": "..." },
 *   { "type": "transition", "text": "CUT TO:" },
 * ]
 */

export type ScreenplayBlockType =
  | "scene_heading"
  | "action"
  | "character"
  | "parenthetical"
  | "dialogue"
  | "transition";

export type ScreenplayBlock = {
  type: ScreenplayBlockType;
  text: string;
};

const BLOCK_TYPES: ScreenplayBlockType[] = [
  "scene_heading",
  "action",
  "character",
  "parenthetical",
  "dialogue",
  "transition",
];

function isBlockType(s: string): s is ScreenplayBlockType {
  return (BLOCK_TYPES as string[]).includes(s);
}

/** True if string looks like our screenplay JSON array. */
export function isScreenplayJsonString(raw: string): boolean {
  const t = raw.trimStart();
  if (!t.startsWith("[")) return false;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return false;
    const first = parsed[0] as Record<string, unknown>;
    return (
      typeof first?.type === "string" &&
      typeof first?.text === "string" &&
      isBlockType(first.type)
    );
  } catch {
    return false;
  }
}

/** Antall synlige tegn (inkl. mellomrom) — for JSON: sum av alle block.text. */
export function getManuscriptDisplayLength(manuscript: string): number {
  if (!manuscript.trim()) return 0;
  if (isScreenplayJsonString(manuscript)) {
    const blocks = parseScreenplayBlocks(manuscript);
    return blocks.reduce((n, b) => n + (b.text?.length ?? 0), 0);
  }
  return manuscript.length;
}

/** Parse JSON blocks; invalid entries become action lines. */
export function parseScreenplayBlocks(raw: string): ScreenplayBlock[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [{ type: "action", text: "" }];
    const out: ScreenplayBlock[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const type = typeof o.type === "string" && isBlockType(o.type) ? o.type : "action";
      const text = typeof o.text === "string" ? o.text : "";
      out.push({ type, text });
    }
    return out.length ? out : [{ type: "action", text: "" }];
  } catch {
    return [{ type: "action", text: "" }];
  }
}

/**
 * Legacy: plain lines, HTML from old rich editor, or Fountain-style `>` lines → action blocks.
 * (Runs in browser for paste/HTML; server-safe path uses strip tags via regex if needed.)
 */
export function legacyTextToScreenplayBlocks(raw: string): ScreenplayBlock[] {
  if (!raw.trim()) return [{ type: "action", text: "" }];
  if (isScreenplayJsonString(raw)) return parseScreenplayBlocks(raw);

  let plain = raw;
  if (/<[a-z][\s\S]*>/i.test(raw)) {
    if (typeof document !== "undefined") {
      const div = document.createElement("div");
      div.innerHTML = raw;
      plain = div.textContent ?? raw;
    } else {
      plain = raw.replace(/<[^>]+>/g, "\n");
    }
  }
  const lines = plain.split(/\r?\n/);
  return lines.map((line) => {
    const m = /^\s*(?:>|&gt;)\s?(.*)$/.exec(line);
    const content = m ? (m[1] ?? "").trimEnd() : line;
    return { type: "action" as const, text: content };
  });
}

/** Uppercase only plain text — never mangle <strong>/<em>/<br> in `text`. */
function uppercaseIfPlain(text: string): string {
  if (/<[a-z][\s/>]/i.test(text)) return text;
  return text.toUpperCase();
}

/** Persist: uppercase scene_heading, character, transition (plain lines only). */
export function normalizeBlocksForSave(blocks: ScreenplayBlock[]): ScreenplayBlock[] {
  return blocks.map((b) => {
    if (b.type === "scene_heading" || b.type === "character" || b.type === "transition") {
      return { ...b, text: uppercaseIfPlain(b.text) };
    }
    return { ...b };
  });
}

export function stringifyScreenplayBlocks(blocks: ScreenplayBlock[]): string {
  return JSON.stringify(normalizeBlocksForSave(blocks));
}
