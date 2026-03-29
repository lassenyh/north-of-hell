import type { JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { sanitizeScreenplayBlockHtml } from "@/lib/manuscript-html";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Serialize one screenplayBlock's inline content for JSON `text`. */
export function blockContentToStorage(node: PMNode): string {
  let needsHtml = false;
  node.forEach((child) => {
    if (child.type.name === "hardBreak") needsHtml = true;
    if (child.isText && child.marks.length > 0) needsHtml = true;
  });
  if (!needsHtml) {
    let plain = "";
    node.forEach((child) => {
      if (child.isText) plain += child.text ?? "";
    });
    return plain;
  }
  const parts: string[] = [];
  node.forEach((child) => {
    if (child.type.name === "hardBreak") {
      parts.push("<br>");
      return;
    }
    if (child.isText) {
      let t = escapeHtml(child.text ?? "");
      if (child.marks.some((m) => m.type.name === "italic")) {
        t = `<em>${t}</em>`;
      }
      if (child.marks.some((m) => m.type.name === "bold")) {
        t = `<strong>${t}</strong>`;
      }
      parts.push(t);
    }
  });
  return parts.join("");
}

const HTMLISH = /<\s*(?:b|strong|i|em|br)\b|<br\s*\/?>/i;

/** Parse stored `text` into Tiptap inline nodes (client; needs DOM). */
export function storageStringToTipTapContent(s: string): JSONContent[] {
  if (!s) return [{ type: "hardBreak" }];
  if (!HTMLISH.test(s)) {
    if (!s.includes("\n")) {
      return s ? [{ type: "text", text: s }] : [{ type: "hardBreak" }];
    }
    const out: JSONContent[] = [];
    s.split("\n").forEach((line, i) => {
      if (i) out.push({ type: "hardBreak" });
      if (line) out.push({ type: "text", text: line });
    });
    return out.length ? out : [{ type: "hardBreak" }];
  }
  if (typeof document === "undefined") {
    return [{ type: "text", text: s.replace(/<[^>]+>/g, "") }];
  }
  const clean = sanitizeScreenplayBlockHtml(s) || "";
  const div = document.createElement("div");
  div.innerHTML = clean || "<br>";
  return domToTipTapContent(div);
}

function domToTipTapContent(root: HTMLElement): JSONContent[] {
  const out: JSONContent[] = [];
  function walk(n: Node, bold: boolean, italic: boolean) {
    if (n.nodeType === Node.TEXT_NODE) {
      const text = n.textContent ?? "";
      if (!text) return;
      const marks: { type: string }[] = [];
      if (bold) marks.push({ type: "bold" });
      if (italic) marks.push({ type: "italic" });
      out.push({
        type: "text",
        text,
        ...(marks.length ? { marks } : {}),
      } as JSONContent);
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === "br") {
      out.push({ type: "hardBreak" });
      return;
    }
    const nb = bold || tag === "b" || tag === "strong";
    const ni = italic || tag === "i" || tag === "em";
    el.childNodes.forEach((c) => walk(c, nb, ni));
  }
  root.childNodes.forEach((c) => walk(c, false, false));
  return out.length ? out : [{ type: "hardBreak" }];
}
