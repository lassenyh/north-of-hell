/**
 * Paste from Fountain-like plain text, PDF export, Google Docs, WriterDuet-style HTML, tables.
 * Detects scene / action / character / dialogue / parenthetical / transition + inline emphasis.
 * PDF: normaliserer mellomrom, slår sammen scene-heading delt på to linjer, fjerner sidetall.
 */

import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { isScreenplayBlockType, type ScreenplayBlock, type ScreenplayBlockType } from "@/lib/screenplay-json";
import { sanitizeScreenplayPasteHtml } from "@/lib/manuscript-html";
import { blockContentToStorage, storageStringToTipTapContent } from "@/lib/screenplay-inline-html";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isSceneHeading(t: string): boolean {
  const s = t.trim();
  if (!s || s.length > 120) return false;
  return (
    /^(INT\.|EXT\.|INT\/EXT|I\/E\.|EST\.|INT |EXT |INT\/EXT )/i.test(s) ||
    (/^\.[A-ZÆØÅ]/i.test(s) && s.length < 90)
  );
}

function isTransition(t: string): boolean {
  const s = t.trim();
  if (!s || s.length > 55) return false;
  if (
    /^(CUT TO|FADE IN|FADE OUT|FADE TO|DISSOLVE TO|SMASH CUT|MATCH CUT|JUMP CUT|TITLE CARD|THE END|END OF)/i.test(
      s
    )
  ) {
    return true;
  }
  const u = s.toUpperCase();
  return u === s && /[A-Z]/.test(s) && /(TO:|OUT\.|IN\.|BLACK)/.test(s) && s.length < 45;
}

function isParenthetical(t: string): boolean {
  return /^\([^)]+\)$/.test(t.trim());
}

function isCharacterLine(t: string): boolean {
  const s = t.trim();
  if (!s || s.length > 44 || s.length < 1) return false;
  if (isSceneHeading(s) || isTransition(s) || isParenthetical(s)) return false;
  if (/\s{2,}/.test(s)) return false;
  const namePart = s.split("(")[0].trim();
  if (!/[A-ZÆØÅ]/.test(namePart)) return false;
  if (namePart !== namePart.toUpperCase()) return false;
  if (/^(INT|EXT|EST)\.?\s*$/i.test(namePart)) return false;
  return true;
}

function trimEndLine(s: string): string {
  return s.replace(/\s+$/, "");
}

/** Scene heading often split in PDF: "INT. ROOM -" on one line, "DAY" on next. */
const SCENE_TIME_SUFFIX = /^(DAY|NIGHT|LATER|CONTINUOUS|MORNING|EVENING|MOMENTS?\s*LATER|SAME|INTERCUT)\s*$/i;
const SCENE_STARTS_WITH_DASH_END = /^(INT\.|EXT\.|EST\.|I\/E\.|INT\/EXT)[\s\S]*[-\u2013]\s*$/i;

/** Page-number lines copied from PDF (e.g. "23", "Page 5", "- 12 -"). */
function isLikelyPageNumber(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^\d{1,4}\s*$/.test(t)) return true;
  if (/^Page\s+\d+\s*$/i.test(t)) return true;
  if (/^-\s*\d+\s*-\s*$/.test(t)) return true;
  return false;
}

/**
 * Normalize text copied from PDF: collapse spaces, merge split scene headings, drop page numbers.
 */
function normalizePdfStyleLines(text: string): { lines: string[]; indents: number[] } {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const source = raw.split("\n").map(line => {
    let indent = 0;
    for (const char of line.match(/^[ \t]*/)?.[0] ?? "") indent += char === "\t" ? 8 - indent % 8 : 1;
    return { text: line.replace(/\s+/g, " ").trim(), indent };
  }).filter(line => !isLikelyPageNumber(line.text));

  const out: { text: string; indent: number }[] = [];
  for (let i = 0; i < source.length; i++) {
    const line = source[i];
    const next = source[i + 1];
    if (
      next != null &&
      line.text.length > 0 &&
      SCENE_STARTS_WITH_DASH_END.test(line.text) &&
      SCENE_TIME_SUFFIX.test(next.text)
    ) {
      out.push({ text: `${line.text} ${next.text}`, indent: line.indent });
      i += 1;
      continue;
    }
    out.push(line);
  }
  return { lines: out.map(line => line.text), indents: out.map(line => line.indent) };
}

/** Fountain / PDF / plain-text screenplay → blocks */
export function parsePlainTextScreenplay(text: string): ScreenplayBlock[] {
  const { lines, indents } = normalizePdfStyleLines(text);
  const hasLayoutIndentation = indents.some(indent => indent >= 12);
  const isCharacterCueAt = (index: number) =>
    isCharacterLine(lines[index]) &&
    (!hasLayoutIndentation || indents[index] >= 18) &&
    !/[.!?]$/.test(lines[index].trim());
  const blocks: ScreenplayBlock[] = [];
  let i = 0;
  /** True after a CHARACTER line until first dialogue (or new char / scene). */
  let expectingDialogueAfterCharacter = false;
  let inDialogue = false;

  while (i < lines.length) {
    const T = lines[i].trim();
    if (!T) {
      // Blank after character: many Fountain-eksporter har tom linje før replikk
      if (expectingDialogueAfterCharacter) {
        i += 1;
        continue;
      }
      inDialogue = false;
      i += 1;
      continue;
    }

    if (isSceneHeading(T)) {
      expectingDialogueAfterCharacter = false;
      inDialogue = false;
      blocks.push({ type: "scene_heading", text: T });
      i += 1;
      continue;
    }

    if (isTransition(T)) {
      expectingDialogueAfterCharacter = false;
      inDialogue = false;
      blocks.push({ type: "transition", text: T });
      i += 1;
      continue;
    }

    if (isParenthetical(T)) {
      blocks.push({ type: "parenthetical", text: T });
      i += 1;
      continue;
    }

    if (isCharacterCueAt(i)) {
      expectingDialogueAfterCharacter = true;
      inDialogue = true;
      blocks.push({ type: "character", text: T });
      i += 1;
      continue;
    }

    if (inDialogue || expectingDialogueAfterCharacter) {
      const dlg: string[] = [];
      while (i < lines.length) {
        const L = lines[i];
        const P = L.trim();
        if (!P) break;
        if (isSceneHeading(P) || isCharacterCueAt(i) || isTransition(P)) break;
        if (isParenthetical(P)) {
          if (dlg.length) {
            blocks.push({ type: "dialogue", text: dlg.join("\n") });
            dlg.length = 0;
          }
          blocks.push({ type: "parenthetical", text: P });
          i += 1;
          continue;
        }
        dlg.push(trimEndLine(L));
        i += 1;
      }
      if (dlg.length) blocks.push({ type: "dialogue", text: dlg.join("\n") });
      expectingDialogueAfterCharacter = false;
      inDialogue = false;
      continue;
    }

    const action: string[] = [];
    while (i < lines.length) {
      const L = lines[i];
      const P = L.trim();
      if (!P) break;
      if (isSceneHeading(P) || isCharacterCueAt(i) || isTransition(P)) break;
      if (isParenthetical(P)) break;
      action.push(trimEndLine(L));
      i += 1;
    }
    if (action.length) blocks.push({ type: "action", text: action.join("\n") });
  }

  if (!blocks.length && text.trim()) {
    return [{ type: "action", text: text.trim() }];
  }
  return blocks.length ? blocks : [{ type: "action", text: "" }];
}

function spanStyles(st: string): { bold: boolean; italic: boolean; underline: boolean } {
  const s = st.toLowerCase();
  return {
    bold: /font-weight:\s*(bold|[67]00|800|900)/.test(s) || /\bfw-bold\b/.test(s),
    italic: /font-style:\s*italic/.test(s),
    underline: /text-decoration(?:-line)?:[^;]*underline/.test(s),
  };
}

/** One block element → storage HTML (strong/em/u/br) */
export function elementInnerToStorageHtml(el: HTMLElement): string {
  function walk(n: Node, bold: boolean, italic: boolean, underline: boolean): string {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n.textContent ?? "";
      if (!t) return "";
      let x = esc(t);
      if (italic) x = `<em>${x}</em>`;
      if (bold) x = `<strong>${x}</strong>`;
      if (underline) x = `<u>${x}</u>`;
      return x;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return "";
    const e = n as HTMLElement;
    const tag = e.tagName.toLowerCase();
    if (tag === "br") return "<br>";
    let b = bold;
    let it = italic;
    let u = underline;
    if (tag === "b" || tag === "strong") b = true;
    if (tag === "i" || tag === "em") it = true;
    if (tag === "u") u = true;
    if (tag === "span") {
      const si = spanStyles(e.getAttribute("style") || "");
      if (si.bold) b = true;
      if (si.italic) it = true;
      if (si.underline) u = true;
    }
    return Array.from(e.childNodes)
      .map((c) => walk(c, b, it, u))
      .join("");
  }
  return Array.from(el.childNodes)
    .map((c) => walk(c, false, false, false))
    .join("")
    .replace(/^(<br>)+|(<br>)+$/g, "")
    .trim();
}

function classAndStyleType(
  el: HTMLElement,
  plain: string
): ScreenplayBlockType | null {
  const declared = el.getAttribute("data-block-type") || el.getAttribute("data-element");
  if (isScreenplayBlockType(declared)) return declared;
  const blob = `${el.className} ${el.getAttribute("style") || ""} ${el.getAttribute("data-element") || ""}`.toLowerCase();
  if (/\bgeneral\b/.test(blob)) return "general";
  if (/sceneheading|scene-heading|slug|scene_heading/.test(blob)) return "scene_heading";
  if (/\bcast[_ -]?list\b/.test(blob)) return "cast_list";
  if (/\bnew[_ -]?act\b/.test(blob)) return "new_act";
  if (/\bend[_ -]?of[_ -]?act\b/.test(blob)) return "end_of_act";
  if (/\bsequence\b/.test(blob)) return "sequence";
  if (/\boutline[_ -]?1\b/.test(blob)) return "outline_1";
  if (/\boutline[_ -]?2\b/.test(blob)) return "outline_2";
  if (/\boutline[_ -]?3\b/.test(blob)) return "outline_3";
  if (/\bsummary\b/.test(blob)) return "summary";
  if (/\bnote\b/.test(blob)) return "note";
  if (/\bshot\b/.test(blob)) return "shot";
  if (/character\b/.test(blob) && !/dialogue/.test(blob)) return "character";
  if (/dialogue/.test(blob)) return "dialogue";
  if (/parenthetic/.test(blob)) return "parenthetical";
  if (/transition/.test(blob)) return "transition";
  if (/\baction\b/.test(blob)) return "action";

  const st = (el.getAttribute("style") || "").toLowerCase();
  if (st.includes("text-align") && st.includes("right")) {
    if (isTransition(plain) || plain.length < 40) return "transition";
  }
  if (st.includes("text-align") && st.includes("center")) {
    if (isSceneHeading(plain)) return "scene_heading";
    if (isCharacterLine(plain)) return "character";
  }
  return null;
}

function inferLineType(plain: string): ScreenplayBlockType {
  const t = plain.trim();
  if (!t) return "action";
  if (isSceneHeading(t)) return "scene_heading";
  if (isTransition(t)) return "transition";
  if (isParenthetical(t)) return "parenthetical";
  if (isCharacterLine(t)) return "character";
  return "action";
}

function collectBlockElements(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  const tables = root.querySelectorAll("table");
  if (tables.length) {
    tables.forEach((table) => {
      table.querySelectorAll("tr").forEach((tr) => {
        tr.querySelectorAll("td, th").forEach((cell) => {
          const el = cell as HTMLElement;
          const p = el.textContent?.replace(/\u00a0/g, " ").trim() ?? "";
          if (p) out.push(el);
        });
      });
    });
    if (out.length) return out;
  }

  const direct = Array.from(root.children);
  if (direct.length) {
    direct.forEach((c) => {
      const tag = c.tagName.toLowerCase();
      if (tag === "p" || tag === "h1" || tag === "h2" || tag === "h3") {
        out.push(c as HTMLElement);
      } else if (tag === "div") {
        const innerP = c.querySelector(":scope > p");
        if (innerP) {
          c.querySelectorAll(":scope > p").forEach((p) => out.push(p as HTMLElement));
        } else if ((c.textContent || "").trim()) {
          out.push(c as HTMLElement);
        }
      }
    });
  }
  if (!out.length) {
    root.querySelectorAll("p").forEach((p) => out.push(p as HTMLElement));
  }
  if (!out.length && (root.textContent || "").trim()) {
    out.push(root);
  }
  return out.filter((el) => (el.textContent || "").replace(/\u00a0/g, " ").trim());
}

/** HTML clipboard → blocks (order + inline marks) */
export function parseHtmlScreenplay(html: string): ScreenplayBlock[] {
  if (typeof document === "undefined") return [];
  const clean = sanitizeScreenplayPasteHtml(html);
  if (!clean.trim()) return [];
  const wrap = document.createElement("div");
  wrap.innerHTML = clean;
  const elements = collectBlockElements(wrap);
  const blocks: ScreenplayBlock[] = [];
  let inDialogue = false;

  for (const el of elements) {
    const rawInner = el.innerHTML;
    const declaredType = classAndStyleType(el, (el.textContent || "").trim());
    const splitByBr =
      !declaredType &&
      /<br\s*\/?>/i.test(rawInner) &&
      !/<\s*p[\s>]/i.test(rawInner) &&
      rawInner.split(/<br\s*\/?>/i).filter((s) => s.replace(/<[^>]+>/g, "").trim()).length >= 2;

    const subBlocks: { plain: string; storage: string }[] = [];
    if (splitByBr) {
      for (const seg of rawInner.split(/<br\s*\/?>/i)) {
        const w = document.createElement("span");
        w.innerHTML = seg.trim();
        const plain = (w.textContent || "").replace(/\u00a0/g, " ").trim();
        if (!plain) continue;
        subBlocks.push({
          plain,
          storage: elementInnerToStorageHtml(w) || esc(plain),
        });
      }
    } else {
      const plain = (el.textContent || "").replace(/\u00a0/g, " ").trim();
      if (plain) {
        subBlocks.push({
          plain,
          storage: elementInnerToStorageHtml(el) || esc(plain),
        });
      }
    }

    for (const { plain, storage } of subBlocks) {
      let type = classAndStyleType(el, plain);
      if (!type) type = inferLineType(plain);

      if (type === "character") inDialogue = true;
      else if (type === "scene_heading" || type === "transition") inDialogue = false;
      else if (inDialogue && type === "action") type = "dialogue";

      blocks.push({ type, text: storage });
    }
  }

  return blocks.length ? blocks : [{ type: "action", text: wrap.textContent?.trim() || "" }];
}

function typeDiversity(blocks: ScreenplayBlock[]): number {
  return new Set(blocks.map((b) => b.type)).size;
}

function shouldInterceptPaste(blocks: ScreenplayBlock[], plain: string): boolean {
  const lines = plain.split(/\n/).filter((l) => l.trim());
  if (lines.length <= 1 && blocks.length <= 1) {
    const b = blocks[0];
    if (b?.type === "scene_heading" && b.text.length > 12) return true;
    return false;
  }
  if (blocks.length >= 2) return true;
  if (lines.length >= 6) return true;
  if (lines.length >= 3 && typeDiversity(blocks) >= 2) return true;
  if (blocks.length >= 10) return true;
  return false;
}

/**
 * Returns null → let default editor paste (single-line rich text etc.).
 */
export function parseScreenplayPaste(plain: string, html: string | null): ScreenplayBlock[] | null {
  const p = plain ?? "";
  const htmlS = html ?? "";
  if (!p.trim() && !htmlS.trim()) return null;

  const explicitHtmlElement = /\bdata-(?:block-type|element)\s*=|\bclass\s*=\s*["'][^"']*(?:scene.?heading|\baction\b|\bcharacter\b|\bdialogue\b|parenthetic|transition|\bshot\b|cast.?list|new.?act|end.?of.?act|\bsequence\b|\bsummary\b|outline.?[123]|\bnote\b|\bgeneral\b)/i.test(htmlS);
  let fromHtml: ScreenplayBlock[] | null = null;
  if (/<(?:p|div|h[1-3]|li|td|th)\b/i.test(htmlS)) {
    try {
      fromHtml = parseHtmlScreenplay(htmlS);
    } catch {
      fromHtml = null;
    }
  }

  const fromPlain = p.trim() ? parsePlainTextScreenplay(p) : [];

  let blocks: ScreenplayBlock[];
  if (fromHtml && explicitHtmlElement) {
    blocks = fromHtml;
  } else if (!p.trim() && fromHtml && fromHtml.length >= 2) {
    blocks = fromHtml;
  } else if (fromHtml && fromHtml.length >= 2) {
    const dh = typeDiversity(fromHtml);
    const dp = typeDiversity(fromPlain);
    blocks =
      dh > dp || (dh === dp && fromHtml.length >= fromPlain.length)
        ? fromHtml
        : fromPlain;
  } else {
    blocks = fromPlain.length ? fromPlain : fromHtml ?? [];
  }

  if (!blocks.length) return null;
  if (explicitHtmlElement && fromHtml?.length) return blocks;
  if (!shouldInterceptPaste(blocks, p || blocks.map((b) => b.text).join("\n"))) return null;
  return blocks;
}

function blockIndexAt(doc: PMNode, pos: number, edge: "start" | "end"): number {
  let p = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const n = doc.child(i);
    const end = p + n.nodeSize;
    if (pos < end || (edge === "end" && pos === end)) return i;
    p += n.nodeSize;
  }
  return Math.max(0, doc.childCount - 1);
}

function blockInnerRange(
  doc: PMNode,
  index: number
): { innerStart: number; innerEnd: number } {
  let p = 0;
  for (let i = 0; i < index; i++) {
    p += doc.child(i).nodeSize;
  }
  const n = doc.child(index);
  return { innerStart: p + 1, innerEnd: p + n.nodeSize - 1 };
}

function docToBlockTexts(editor: Editor): { type: ScreenplayBlockType; text: string }[] {
  const out: { type: ScreenplayBlockType; text: string }[] = [];
  const doc = editor.state.doc;
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    if (node.type.name !== "screenplayBlock") continue;
    out.push({
      type: node.attrs.blockType as ScreenplayBlockType,
      text: blockContentToStorage(node),
    });
  }
  return out;
}

/** Insert parsed blocks at selection (splits current block; supports multi-block selection). */
export function applyScreenplayPaste(editor: Editor, pasted: ScreenplayBlock[]): boolean {
  if (!pasted.length) return false;
  const { state } = editor;
  const { from, to } = state.selection;
  const schema = state.schema;
  const existing = docToBlockTexts(editor);
  if (!existing.length) {
    editor.commands.setContent({
      type: "doc",
      content: pasted.map((b) => ({
        type: "screenplayBlock",
        attrs: { blockType: b.type },
        content: storageStringToTipTapContent(b.text),
      })),
    });
    return true;
  }

  const i0 = blockIndexAt(state.doc, from, "start");
  const i1 = from === to ? i0 : blockIndexAt(state.doc, to, "end");

  const { innerStart: is0, innerEnd: ie0 } = blockInnerRange(state.doc, i0);
  const { innerStart: is1, innerEnd: ie1 } = blockInnerRange(state.doc, i1);

  const a = Math.min(from, to);
  const b = Math.max(from, to);

  const beforeEnd = Math.min(Math.max(a, is0), ie0);
  const afterStart = Math.max(Math.min(b, ie1), is1);

  const beforeFrag = state.doc.slice(is0, beforeEnd).content;
  const afterFrag = state.doc.slice(afterStart, ie1).content;

  const blockNode = state.doc.child(i0);
  const endBlockNode = state.doc.child(i1);
  const btStart = blockNode.attrs.blockType as ScreenplayBlockType;
  const btEnd = endBlockNode.attrs.blockType as ScreenplayBlockType;

  const beforeText = blockContentToStorage(
    schema.nodes.screenplayBlock.create({ blockType: btStart }, beforeFrag)
  );
  const afterText = blockContentToStorage(
    schema.nodes.screenplayBlock.create({ blockType: btEnd }, afterFrag)
  );

  const merged: ScreenplayBlock[] = [
    ...existing.slice(0, i0),
    ...(beforeText.trim() ? [{ type: btStart, text: beforeText }] : []),
    ...pasted,
    ...(afterText.trim() ? [{ type: btEnd, text: afterText }] : []),
    ...existing.slice(i1 + 1),
  ];

  editor.commands.setContent({
    type: "doc",
    content: merged.map((b) => ({
      type: "screenplayBlock",
      attrs: { blockType: b.type },
      content: storageStringToTipTapContent(b.text),
    })),
  });

  editor.commands.focus("end");
  return true;
}
