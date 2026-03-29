"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import {
  editorRootToManuscript,
  lineToEditorInnerHtml,
  manuscriptToEditorHtml,
  sanitizeManuscriptLine,
  sanitizePasteRootHtml,
} from "@/lib/manuscript-html";

export type ManuscriptRichEditorHandle = {
  getManuscript: () => string;
};

type Props = {
  defaultValue: string;
  onChange: (next: string) => void;
  className?: string;
  minRows?: number;
};

function getCurrentLineEl(
  sel: Selection,
  root: HTMLElement
): HTMLElement | null {
  if (!sel.anchorNode) return null;
  if (sel.anchorNode === root) {
    const lines = root.querySelectorAll(":scope > [data-line]");
    const o = sel.anchorOffset;
    if (lines.length === 0) return null;
    if (o <= 0) return lines[0] as HTMLElement;
    if (o >= lines.length) return lines[lines.length - 1] as HTMLElement;
    return lines[o - 1] as HTMLElement;
  }
  let n: Node | null =
    sel.anchorNode.nodeType === Node.TEXT_NODE
      ? sel.anchorNode.parentElement
      : (sel.anchorNode as HTMLElement);
  while (n && n !== root) {
    if (
      n instanceof HTMLElement &&
      n.getAttribute("data-line") === "1" &&
      n.parentElement === root
    ) {
      return n;
    }
    n = n.parentElement;
  }
  return null;
}

function insertLineAfter(lineEl: HTMLElement): HTMLElement {
  const next = document.createElement("div");
  next.setAttribute("data-line", "1");
  next.innerHTML = "<br>";
  lineEl.parentElement?.insertBefore(next, lineEl.nextSibling);
  return next;
}

function focusStart(el: HTMLElement) {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

export const ManuscriptRichEditor = forwardRef<
  ManuscriptRichEditorHandle,
  Props
>(function ManuscriptRichEditor(
  { defaultValue, onChange, className = "", minRows = 5 },
  ref
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const initialRef = useRef(defaultValue);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const emit = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    onChange(editorRootToManuscript(root));
  }, [onChange]);

  useImperativeHandle(ref, () => ({
    getManuscript: () =>
      rootRef.current ? editorRootToManuscript(rootRef.current) : "",
  }));

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.innerHTML = manuscriptToEditorHtml(initialRef.current);
    queueMicrotask(() => {
      if (rootRef.current === root) {
        onChangeRef.current(editorRootToManuscript(root));
      }
    });
  }, []);

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const html = e.clipboardData.getData("text/html");
      const plain = e.clipboardData.getData("text/plain") ?? "";
      const root = rootRef.current;
      if (!root) return;

      const sel = window.getSelection();
      const lineEl =
        sel && sel.rangeCount ? getCurrentLineEl(sel, root) : null;
      const targetLine =
        lineEl ?? (root.querySelector("[data-line]") as HTMLElement) ?? root;

      if (html && /<[a-z]/i.test(html)) {
        const clean = sanitizePasteRootHtml(html);
        const tmp = document.createElement("div");
        tmp.innerHTML = clean;
        tmp.querySelectorAll("u").forEach((u) => {
          const em = document.createElement("em");
          em.innerHTML = u.innerHTML;
          u.replaceWith(em);
        });
        const blocks: string[] = [];
        const walk = (node: Element) => {
          const tag = node.tagName.toLowerCase();
          if (tag === "p" || tag === "div") {
            const inner = sanitizeManuscriptLine(node.innerHTML);
            if (inner || node.textContent?.trim()) blocks.push(inner || "");
          }
        };
        Array.from(tmp.children).forEach((c) => walk(c as Element));
        if (blocks.length === 0 && tmp.textContent?.trim()) {
          blocks.push(sanitizeManuscriptLine(tmp.innerHTML));
        }
        if (blocks.length === 0) {
          plain.split(/\r?\n/).forEach(() => blocks.push(""));
        }

        targetLine.innerHTML = blocks[0] ? blocks[0] : "<br>";
        let after = targetLine;
        for (let i = 1; i < blocks.length; i++) {
          after = insertLineAfter(after);
          after.innerHTML = blocks[i] ? blocks[i] : "<br>";
        }
      } else {
        const lines = plain.split(/\r?\n/);
        if (lines.length <= 1) {
          document.execCommand("insertText", false, plain);
        } else {
          targetLine.innerHTML = lineToEditorInnerHtml(lines[0]);
          let after = targetLine;
          for (let i = 1; i < lines.length; i++) {
            after = insertLineAfter(after);
            after.innerHTML = lineToEditorInnerHtml(lines[i]);
          }
        }
      }
      emit();
    },
    [emit]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        document.execCommand("bold");
        emit();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        document.execCommand("italic");
        emit();
        return;
      }
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        document.execCommand("insertLineBreak");
        emit();
        return;
      }
      if ((e.key === "Enter" || e.key === "NumpadEnter") && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const root = rootRef.current;
        const sel = window.getSelection();
        if (!root || !sel?.rangeCount) return;

        let line = getCurrentLineEl(sel, root);
        const lineEls = () =>
          Array.from(root.querySelectorAll(":scope > [data-line]"));

        if (!line) {
          const rows = lineEls();
          if (rows.length === 0) {
            const d = document.createElement("div");
            d.setAttribute("data-line", "1");
            d.innerHTML = "<br>";
            root.appendChild(d);
            focusStart(d);
            emit();
            return;
          }
          const last = rows[rows.length - 1] as HTMLElement;
          const next = insertLineAfter(last);
          focusStart(next);
          emit();
          return;
        }

        const range = sel.getRangeAt(0);
        const endRange = document.createRange();
        endRange.selectNodeContents(line);
        try {
          endRange.setStart(range.startContainer, range.startOffset);
        } catch {
          const next = insertLineAfter(line);
          focusStart(next);
          emit();
          return;
        }

        const tail = endRange.extractContents();
        const nextLine = insertLineAfter(line);
        nextLine.innerHTML = "";
        if (
          tail.textContent?.trim() ||
          tail.querySelector?.("b,strong,i,em,br")
        ) {
          nextLine.appendChild(tail);
          if (!nextLine.textContent?.trim() && !nextLine.querySelector("br")) {
            nextLine.appendChild(document.createElement("br"));
          }
        } else {
          nextLine.innerHTML = "<br>";
        }
        const lineEmpty =
          !line.textContent?.trim() && !line.querySelector("b,strong,i,em");
        if (lineEmpty) line.innerHTML = "<br>";
        focusStart(nextLine);
        emit();
      }
    },
    [emit]
  );

  return (
    <div
      ref={rootRef}
      role="textbox"
      aria-multiline
      contentEditable
      suppressContentEditableWarning
      onInput={emit}
      onBlur={emit}
      onPaste={onPaste}
      onKeyDown={onKeyDown}
      className={`min-w-0 rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-[12pt] leading-[1.05] text-white outline-none [font-family:var(--font-courier-prime),Courier,monospace] focus:border-[#eaa631] focus:ring-1 focus:ring-[#eaa631] [&_[data-line]]:min-h-[1.05em] ${className}`}
      style={{ minHeight: `${minRows * 1.05 * 12 * 1.333}px` }}
    />
  );
});
