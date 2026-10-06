import { sanitizeHtml } from "./safe-html";

const INLINE = ["b", "strong", "i", "em", "u"] as const;

const PURIFY_INLINE = {
  ALLOWED_TAGS: [...INLINE],
  ALLOWED_ATTR: [] as string[],
};

const PURIFY_PASTE = {
  ALLOWED_TAGS: ["p", "div", "br", "b", "strong", "i", "em", "span", "u"],
  ALLOWED_ATTR: [] as string[],
};

/** Screenplay JSON block `text`: inline formatting + line breaks */
const PURIFY_SCREENPLAY_BLOCK = {
  ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "br"],
  ALLOWED_ATTR: [] as string[],
};

export function sanitizeScreenplayBlockHtml(html: string): string {
  if (!html || html === "<br>") return "";
  return sanitizeHtml(html, { tags: PURIFY_SCREENPLAY_BLOCK.ALLOWED_TAGS }).trim();
}

/** Clipboard HTML from Docs / Final Draft / WriterDuet — parsed client-side only */
const PURIFY_SCREENPLAY_PASTE = {
  ALLOWED_TAGS: [
    "p",
    "div",
    "br",
    "b",
    "strong",
    "i",
    "em",
    "u",
    "span",
    "h1",
    "h2",
    "h3",
    "li",
    "ul",
    "ol",
    "table",
    "tbody",
    "thead",
    "tr",
    "td",
    "th",
  ],
  ALLOWED_ATTR: ["style", "class", "align", "data-element", "data-block-type"],
};

export function sanitizeScreenplayPasteHtml(html: string): string {
  if (!html?.trim()) return "";
  return sanitizeHtml(html, { tags: PURIFY_SCREENPLAY_PASTE.ALLOWED_TAGS, attributes: PURIFY_SCREENPLAY_PASTE.ALLOWED_ATTR });
}

const HAS_INLINE_MARKUP = /<\s*\/?\s*(b|strong|i|em|u|br)\b/i;

/** Kun & og < — `>` må være uendret for Fountain-midtstilling (> …). */
function escapeHtmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

/** Safe inline HTML for one manuscript line (storage + display). */
export function sanitizeManuscriptLine(html: string): string {
  if (!html || html === "<br>") return "";
  return sanitizeHtml(html, { tags: PURIFY_INLINE.ALLOWED_TAGS }).trim();
}

/** One line → editor innerHTML (legacy plain vs inline HTML). */
export function lineToEditorInnerHtml(line: string): string {
  if (!line) return "<br>";
  if (HAS_INLINE_MARKUP.test(line)) {
    const s = sanitizeScreenplayBlockHtml(line);
    return s || "<br>";
  }
  return escapeHtmlText(line) || "<br>";
}

export function lineHasInlineMarkup(line: string): boolean {
  return HAS_INLINE_MARKUP.test(line);
}

/** Clipboard / paste: block structure → later split into lines. */
export function sanitizePasteRootHtml(html: string): string {
  return sanitizeHtml(html, { tags: PURIFY_PASTE.ALLOWED_TAGS }).trim();
}

export function manuscriptToEditorHtml(manuscript: string): string {
  const lines = manuscript.split(/\r?\n/);
  if (lines.length === 0 || (lines.length === 1 && !lines[0])) {
    return `<div data-line="1"><br></div>`;
  }
  return lines
    .map((line) => {
      const inner = lineToEditorInnerHtml(line);
      return `<div data-line="1">${inner}</div>`;
    })
    .join("");
}

export function editorRootToManuscript(root: HTMLElement): string {
  const rows = root.querySelectorAll(":scope > [data-line]");
  return Array.from(rows)
    .map((div) => {
      const el = div as HTMLElement;
      const h = el.innerHTML.trim();
      if (h === "<br>" || h === "") return "";
      if (HAS_INLINE_MARKUP.test(h)) {
        return sanitizeManuscriptLine(el.innerHTML);
      }
      return el.textContent ?? "";
    })
    .join("\n");
}
