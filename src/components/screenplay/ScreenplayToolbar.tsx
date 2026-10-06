"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import type { ScreenplayBlockType } from "@/lib/screenplay-json";
import { getCurrentBlockType, SCREENPLAY_ELEMENT_OPTIONS, setScreenplayElement } from "./ScreenplayExtensions";

export function ScreenplayToolbar({ editor }: { editor: Editor | null }) {
  const [, refresh] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const sync = () => refresh(value => value + 1);
    editor.on("selectionUpdate", sync);
    editor.on("update", sync);
    return () => {
      editor.off("selectionUpdate", sync);
      editor.off("update", sync);
    };
  }, [editor]);

  const activeType = getCurrentBlockType(editor) ?? "action";
  const setMark = (mark: "bold" | "italic" | "underline") => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (mark === "bold") chain.toggleBold().run();
    if (mark === "italic") chain.toggleItalic().run();
    if (mark === "underline") chain.toggleUnderline().run();
  };

  return <>
    <span>Screenplay</span>
    <label className="sb-manus-element-label">Elements
      <select aria-label="Screenplay element" value={activeType} disabled={!editor} onChange={event => editor && setScreenplayElement(editor, event.target.value as ScreenplayBlockType)}>
        {SCREENPLAY_ELEMENT_OPTIONS.map(item => <option key={item.type} value={item.type}>[{item.key}] {item.label}</option>)}
      </select>
    </label>
    <span className="sb-manus-font">Courier Prime · 12 pt</span>
    <span className="sb-divider" />
    {([ ["bold", "Bold", "B"], ["italic", "Italic", "I"], ["underline", "Underline", "U"] ] as const).map(([mark, label, icon]) => <button key={mark} type="button" aria-label={label} title={`${label} · ⌘/Ctrl ${icon}`} aria-pressed={editor?.isActive(mark) ?? false} disabled={!editor} onMouseDown={event => event.preventDefault()} onClick={() => setMark(mark)}>{icon}</button>)}
    <span className="sb-divider" />
    <button type="button" aria-label="Undo screenplay edit" title="Undo · ⌘/Ctrl Z" disabled={!editor || !editor.can().undo()} onMouseDown={event => event.preventDefault()} onClick={() => editor?.chain().focus().undo().run()}>↶</button>
    <button type="button" aria-label="Redo screenplay edit" title="Redo · ⌘/Ctrl Shift Z" disabled={!editor || !editor.can().redo()} onMouseDown={event => event.preventDefault()} onClick={() => editor?.chain().focus().redo().run()}>↷</button>
    <span className="sb-toolbar-help">Empty line + Enter: Elements · Tab: next element · Right-click: change element</span>
  </>;
}
