import type { ScreenplayBlock } from "./screenplay-json";

export type SmartTypeKind = "intro" | "location" | "time" | "character" | "extension" | "transition";
export type SmartTypeLists = Record<SmartTypeKind, string[]>;
export type SmartTypeMatch = { kind: SmartTypeKind; prefix: string; start: number; items: string[] };

const DEFAULT_INTROS = ["INT.", "EXT.", "I/E.", "INT./EXT.", "EXT./INT."];
const DEFAULT_TIMES = ["DAY", "NIGHT", "AFTERNOON", "MORNING", "EVENING", "LATER", "MOMENTS LATER", "CONTINUOUS", "THE NEXT DAY", "MAGIC HOUR", "DAWN", "DUSK", "SAME", "SAME TIME"];
const DEFAULT_EXTENSIONS = ["(V.O.)", "(O.S.)", "(O.C.)", "(CONT'D)"];
const DEFAULT_TRANSITIONS = ["CUT TO:", "DISSOLVE TO:", "FADE TO:", "FADE OUT."];
const INTRO_PATTERN = /^(INT\.\/EXT\.|EXT\.\/INT\.|INT\.|EXT\.|I\/E\.)\s*/i;

function plain(text: string): string {
  return text.replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").trim();
}

function add(list: string[], raw: string) {
  const value = raw.trim().replace(/\s+/g, " ").toUpperCase();
  if (value && !list.some(item => item.toUpperCase() === value)) list.push(value);
}

/** Lists are reconstructed from the current draft; no private suggestion state can leak into publication. */
export function collectSmartTypeLists(blocks: ScreenplayBlock[]): SmartTypeLists {
  const lists: SmartTypeLists = { intro: [...DEFAULT_INTROS], location: [], time: [...DEFAULT_TIMES], character: [], extension: [...DEFAULT_EXTENSIONS], transition: [...DEFAULT_TRANSITIONS] };
  for (const block of blocks) {
    const value = plain(block.text);
    if (!value) continue;
    if (block.type === "character") {
      const extension = /\s+(\([^)]*\))$/.exec(value);
      add(lists.character, extension ? value.slice(0, extension.index) : value);
      if (extension) add(lists.extension, extension[1]);
    } else if (block.type === "transition") {
      add(lists.transition, value);
    } else if (block.type === "scene_heading") {
      const intro = INTRO_PATTERN.exec(value);
      if (!intro) continue;
      add(lists.intro, intro[1]);
      const tail = value.slice(intro[0].length);
      const separator = /\s+-\s+/.exec(tail);
      if (separator) {
        add(lists.location, tail.slice(0, separator.index));
        add(lists.time, tail.slice(separator.index + separator[0].length));
      } else add(lists.location, tail);
    }
  }
  return lists;
}

/** The text before the caret determines which part of a screenplay element is being typed. */
export function matchSmartType(type: ScreenplayBlock["type"], beforeCaret: string, lists: SmartTypeLists): SmartTypeMatch | null {
  let kind: SmartTypeKind;
  let start = 0;
  if (type === "character") {
    const extension = /\s+\([^)]*$/.exec(beforeCaret);
    if (extension) { kind = "extension"; start = extension.index + extension[0].indexOf("("); }
    else { kind = "character"; }
  } else if (type === "transition") {
    kind = "transition";
  } else if (type === "scene_heading") {
    const intro = INTRO_PATTERN.exec(beforeCaret);
    if (!intro) { kind = "intro"; }
    else {
      const separator = /\s+-\s+/.exec(beforeCaret.slice(intro[0].length));
      if (separator) { kind = "time"; start = intro[0].length + separator.index + separator[0].length; }
      else { kind = "location"; start = intro[0].length; }
    }
  } else return null;
  const prefix = beforeCaret.slice(start).trimStart();
  start += beforeCaret.slice(start).length - beforeCaret.slice(start).trimStart().length;
  const items = lists[kind].filter(item => item.toUpperCase().startsWith(prefix.toUpperCase()) && item.toUpperCase() !== prefix.toUpperCase()).slice(0, 20);
  return items.length ? { kind, prefix, start, items } : null;
}

export function sceneHeadingTabInsertion(text: string): string | null {
  const trimmed = text.trimEnd();
  if (/^(INT|EXT|I\/E|INT\/EXT|EXT\/INT)$/i.test(trimmed)) return ". ";
  const intro = INTRO_PATTERN.exec(text);
  if (!intro) return null;
  if (text.endsWith(" - ")) return "";
  if (text.trimEnd() === intro[1]) return text.endsWith(" ") ? "" : " ";
  if (!/\s+-\s+/.test(text.slice(intro[0].length))) return " - ";
  return null;
}
