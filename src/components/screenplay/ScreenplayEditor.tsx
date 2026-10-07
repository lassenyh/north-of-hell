"use client";

/**
 * Per-frame screenplay editor (Tiptap). Data shape (JSON string in Supabase):
 *   [{ "type": ScreenplayBlockType, "text": "..." }, ...]
 * Shortcuts: Mod+0…9 and platform-specific extra elements; SmartType uses arrows, Tab and Enter.
 */

import { EditorContent, useEditor } from "@tiptap/react";
import { UndoRedo } from "@tiptap/extensions";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import {
  getCurrentBlockType,
  setScreenplayElement,
  screenplayEditorExtensions,
  SCREENPLAY_BLOCK_LABEL,
  SCREENPLAY_ELEMENT_OPTIONS,
} from "./ScreenplayExtensions";
import {
  legacyTextToScreenplayBlocks,
  stringifyScreenplayBlocks,
  type ScreenplayBlock,
  type ScreenplayBlockType,
} from "@/lib/screenplay-json";
import {
  blockContentToStorage,
  storageStringToTipTapContent,
} from "@/lib/screenplay-inline-html";
import {
  applyScreenplayPaste,
  parseScreenplayPaste,
} from "@/lib/screenplay-paste";
import { collectSmartTypeLists, matchSmartType, type SmartTypeKind } from "@/lib/screenplay-smarttype";

type SmartSuggestion = {
  kind: SmartTypeKind;
  prefix: string;
  items: string[];
  activeIndex: number;
  from: number;
  to: number;
  left: number;
  top: number;
};
type ElementPicker = { left: number; top: number; activeIndex: number };

const SMART_LABELS: Record<SmartTypeKind, string> = {
  intro: "Scene Intro", location: "Location", time: "Time of Day", character: "Character",
  extension: "Character Extension", transition: "Transition",
};

function blocksToDoc(blocks: ScreenplayBlock[]): JSONContent {
  return {
    type: "doc",
    content: blocks.map((b) => ({
      type: "screenplayBlock",
      attrs: { blockType: b.type },
      content: storageStringToTipTapContent(b.text),
    })),
  };
}

function editorToBlocks(editor: Editor): ScreenplayBlock[] {
  const blocks: ScreenplayBlock[] = [];
  const doc = editor.state.doc;
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    if (node.type.name !== "screenplayBlock") continue;
    blocks.push({
      type: node.attrs.blockType as ScreenplayBlock["type"],
      text: blockContentToStorage(node),
    });
  }
  return blocks.length ? blocks : [{ type: "action", text: "" }];
}

type Props = {
  /** Raw `frame.text` from DB (JSON array or legacy HTML/plain) */
  initialContent: string;
  onChange: (jsonString: string) => void;
  /** Fires when Tiptap is ready (enables Save after lazy load). */
  onReady?: () => void;
  /** list = scene/action midtstilt, grid = sidestilt */
  layout?: "list" | "grid";
  className?: string;
  minRows?: number;
  /** Other screenplay sections in the same draft feed the shared SmartType lists. */
  smartTypeBlocks?: ScreenplayBlock[];
  onEditorChange?: (editor: Editor | null) => void;
  onSelectionChange?: (editor: Editor) => void;
};

export function ScreenplayEditor({
  initialContent,
  onChange,
  onReady,
  layout = "list",
  className = "",
  minRows = 5,
  smartTypeBlocks,
  onEditorChange,
  onSelectionChange,
}: Props) {
    const onChangeRef = useRef(onChange);
    const onReadyRef = useRef(onReady);
    const onEditorChangeRef = useRef(onEditorChange);
    const onSelectionChangeRef = useRef(onSelectionChange);
    useEffect(() => {
      onChangeRef.current = onChange;
      onReadyRef.current = onReady;
      onEditorChangeRef.current = onEditorChange;
      onSelectionChangeRef.current = onSelectionChange;
    }, [onChange, onReady, onEditorChange, onSelectionChange]);
    const editorRef = useRef<Editor | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const smartSourceRef = useRef(smartTypeBlocks);
    useEffect(() => { smartSourceRef.current = smartTypeBlocks; }, [smartTypeBlocks]);
    const smartRef = useRef<SmartSuggestion | null>(null);
    const dismissedRef = useRef<string | null>(null);
    const [smart, setSmart] = useState<SmartSuggestion | null>(null);
    const pickerRef = useRef<ElementPicker | null>(null);
    const [picker, setPicker] = useState<ElementPicker | null>(null);

    const setSuggestion = useCallback((value: SmartSuggestion | null) => {
      smartRef.current = value;
      setSmart(value);
    }, []);

    const setElementPicker = useCallback((value: ElementPicker | null) => {
      pickerRef.current = value;
      setPicker(value);
    }, []);

    const openElementPicker = useCallback((ed: Editor, at?: { x: number; y: number }) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const coords = ed.view.coordsAtPos(ed.state.selection.from);
      const current = getCurrentBlockType(ed);
      const popupHeight = Math.min(window.innerHeight * 0.66, 540) + 54;
      setSuggestion(null);
      setElementPicker({
        left: Math.max(8, Math.min((at?.x ?? coords.left), window.innerWidth - 260)),
        top: Math.max(8, Math.min((at?.y ?? coords.bottom) + 3, window.innerHeight - popupHeight - 8)),
        activeIndex: Math.max(0, SCREENPLAY_ELEMENT_OPTIONS.findIndex(item => item.type === current)),
      });
    }, [setElementPicker, setSuggestion]);

    const chooseElement = useCallback((type: ScreenplayBlockType) => {
      const ed = editorRef.current;
      setElementPicker(null);
      if (ed) setScreenplayElement(ed, type);
    }, [setElementPicker]);

    const refreshSmartType = useCallback((ed: Editor) => {
      const { selection } = ed.state;
      const parent = selection.$from.parent;
      const trailingText = parent.textBetween(selection.$from.parentOffset, parent.content.size, " ");
      if (pickerRef.current || !ed.isFocused || !selection.empty || parent.type.name !== "screenplayBlock" || trailingText.trim()) {
        setSuggestion(null);
        return;
      }
      const beforeCaret = parent.textBetween(0, selection.$from.parentOffset, " ");
      const source = [...(smartSourceRef.current ?? []), ...editorToBlocks(ed)];
      const match = matchSmartType(parent.attrs.blockType as ScreenplayBlock["type"], beforeCaret, collectSmartTypeLists(source));
      const key = `${selection.from}:${beforeCaret}`;
      if (!match || dismissedRef.current === key) { setSuggestion(null); return; }
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const coords = ed.view.coordsAtPos(selection.from);
      const bounds = wrapper.getBoundingClientRect();
      setSuggestion({
        ...match,
        activeIndex: 0,
        from: selection.from - (beforeCaret.length - match.start),
        to: selection.from,
        left: Math.max(0, coords.left - bounds.left),
        top: coords.bottom - bounds.top,
      });
    }, [setSuggestion]);

    const acceptSmartType = useCallback((index: number) => {
      const ed = editorRef.current;
      const suggestion = smartRef.current;
      if (!ed || !suggestion) return false;
      const item = suggestion.items[index];
      if (!item) return false;
      const value = suggestion.kind === "intro" ? `${item} ` : suggestion.kind === "location" ? `${item} - ` : item;
      const tr = ed.state.tr.insertText(value, suggestion.from, suggestion.to);
      tr.setSelection(TextSelection.create(tr.doc, suggestion.from + value.length));
      ed.view.dispatch(tr);
      ed.commands.focus();
      return true;
    }, []);

    const [initBlocks] = useState(() =>
      legacyTextToScreenplayBlocks(initialContent)
    );
    const [blockLabel, setBlockLabel] = useState<string>("Action");

    const emit = useCallback((editor: Editor) => {
      const json = stringifyScreenplayBlocks(editorToBlocks(editor));
      onChangeRef.current(json);
    }, []);

    const editor = useEditor(
      {
        immediatelyRender: false,
        extensions: [...screenplayEditorExtensions(), UndoRedo],
        content: blocksToDoc(initBlocks),
        editorProps: {
          attributes: {
            class: `screenplay-manuscript-flow ProseMirror min-w-0 rounded-2xl border border-zinc-700 bg-zinc-900 px-2 py-2 text-white outline-none focus:border-[#eaa631] focus:ring-1 focus:ring-[#eaa631] ${className}`,
            style: `min-height: ${minRows * 1.15 * 12 * 1.333}px`,
          },
          handlePaste(_view, event) {
            const ed = editorRef.current;
            if (!ed) return false;
            const plain = event.clipboardData?.getData("text/plain") ?? "";
            const html = event.clipboardData?.getData("text/html") ?? null;
            const blocks = parseScreenplayPaste(plain, html);
            if (!blocks) return false;
            if (!applyScreenplayPaste(ed, blocks)) return false;
            event.preventDefault();
            queueMicrotask(() => emit(ed));
            return true;
          },
          handleDOMEvents: {
            contextmenu(view, event) {
              const mouse = event as MouseEvent;
              const hit = view.posAtCoords({ left: mouse.clientX, top: mouse.clientY });
              if (hit) view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(hit.pos))));
              event.preventDefault();
              view.focus();
              const ed = editorRef.current;
              if (ed) openElementPicker(ed, { x: mouse.clientX, y: mouse.clientY });
              return true;
            },
          },
          handleKeyDown(_view, event) {
            const ed = editorRef.current;
            const picker = pickerRef.current;
            if (picker) {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const direction = event.key === "ArrowDown" ? 1 : -1;
                setElementPicker({ ...picker, activeIndex: (picker.activeIndex + direction + SCREENPLAY_ELEMENT_OPTIONS.length) % SCREENPLAY_ELEMENT_OPTIONS.length });
                return true;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                chooseElement(SCREENPLAY_ELEMENT_OPTIONS[picker.activeIndex].type);
                return true;
              }
              const quickChoice = !event.altKey && !event.ctrlKey && !event.metaKey
                ? SCREENPLAY_ELEMENT_OPTIONS.find(item => item.key.toLowerCase() === event.key.toLowerCase())
                : undefined;
              if (quickChoice) {
                event.preventDefault();
                chooseElement(quickChoice.type);
                return true;
              }
              if (event.key === "Escape") { event.preventDefault(); setElementPicker(null); return true; }
              setElementPicker(null);
            }
            if (event.key === "Enter" && ed?.state.selection.empty && ed.state.selection.$from.parent.type.name === "screenplayBlock" && !ed.state.selection.$from.parent.textContent.trim()) {
              event.preventDefault();
              openElementPicker(ed);
              return true;
            }
            const suggestion = smartRef.current;
            if (!suggestion) return false;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const direction = event.key === "ArrowDown" ? 1 : -1;
              setSuggestion({ ...suggestion, activeIndex: (suggestion.activeIndex + direction + suggestion.items.length) % suggestion.items.length });
              return true;
            }
            if (event.key === "Enter" && !suggestion.prefix && (suggestion.kind === "intro" || suggestion.kind === "character" || suggestion.kind === "transition")) return false;
            if (event.key === "Tab" || event.key === "Enter") {
              event.preventDefault();
              return acceptSmartType(suggestion.activeIndex);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              const ed = editorRef.current;
              if (ed) dismissedRef.current = `${ed.state.selection.from}:${ed.state.selection.$from.parent.textContent}`;
              setSuggestion(null);
              return true;
            }
            return false;
          },
        },
        onCreate: ({ editor: ed }) => {
          emit(ed);
          const t = getCurrentBlockType(ed);
          if (t) setBlockLabel(SCREENPLAY_BLOCK_LABEL[t]);
          refreshSmartType(ed);
        },
        onUpdate: ({ editor: ed }) => {
          const type = getCurrentBlockType(ed);
          if (type === "action" && /^\s*(?:INT\.|EXT\.|I\/E\.)/i.test(ed.state.selection.$from.parent.textContent)) {
            setScreenplayElement(ed, "scene_heading");
            return;
          }
          emit(ed);
          const t = type;
          if (t) setBlockLabel(SCREENPLAY_BLOCK_LABEL[t]);
          refreshSmartType(ed);
          onSelectionChangeRef.current?.(ed);
        },
        onSelectionUpdate: ({ editor: ed }) => {
          const t = getCurrentBlockType(ed);
          if (t) setBlockLabel(SCREENPLAY_BLOCK_LABEL[t]);
          refreshSmartType(ed);
          onSelectionChangeRef.current?.(ed);
        },
        onFocus: ({ editor: ed }) => { refreshSmartType(ed); onSelectionChangeRef.current?.(ed); },
        onBlur: () => { setSuggestion(null); setElementPicker(null); },
      },
      []
    );

    const readyRef = useRef(false);
    useEffect(() => {
      if (!editor) return;
      editorRef.current = editor;
      onEditorChangeRef.current?.(editor);
      onSelectionChangeRef.current?.(editor);
      if (!readyRef.current) {
        readyRef.current = true;
        onReadyRef.current?.();
      }
      return () => {
        editorRef.current = null;
        onEditorChangeRef.current?.(null);
      };
    }, [editor]);
    if (!editor) {
      return (
        <div
          className={`min-w-0 rounded-2xl border border-zinc-700 bg-zinc-900 px-2 py-2 ${className}`}
          style={{ minHeight: `${minRows * 1.15 * 12 * 1.333}px` }}
          aria-hidden
        />
      );
    }

    return (
      <div ref={wrapperRef} className="relative space-y-1" data-layout={layout}>
        <div className="flex items-center justify-between gap-2 px-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {blockLabel}
          </span>
          <span className="text-[10px] text-zinc-600">
            ⌘/Ctrl 0–9 · extras: Mac ⌘⌃ / Win Ctrl+Shift
          </span>
        </div>
        <EditorContent editor={editor} />
        {picker && <div className="fixed z-40 min-w-56 overflow-hidden rounded-lg border border-[#a17d46] bg-[#f7f4ed] text-[#221d17] shadow-xl" style={{ left: picker.left, top: picker.top }} role="listbox" aria-label="Screenplay Elements">
          <div className="border-b border-[#d8d0c3] px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#806f54]">Elements</div>
          <div className="max-h-[min(66vh,540px)] overflow-y-auto">{SCREENPLAY_ELEMENT_OPTIONS.map((item, index) => <button key={item.type} type="button" role="option" aria-selected={index === picker.activeIndex} className={`block w-full px-3 py-1 text-left text-sm ${index === picker.activeIndex ? "bg-[#245eb7] text-white" : "hover:bg-[#e5dfd3]"}`} onMouseDown={event => event.preventDefault()} onClick={() => chooseElement(item.type)}>[{item.key}] {item.label}</button>)}</div>
          <div className="border-t border-[#d8d0c3] px-3 py-1 text-[10px] text-[#806f54]">↑↓ select · Enter confirm · Esc close</div>
        </div>}
        {smart && <div className="pointer-events-none absolute z-20" style={{ left: smart.left, top: smart.top - 22 }} aria-hidden="true"><span className="whitespace-pre text-[12pt] text-zinc-400/75 [font-family:var(--font-courier-prime),Courier,monospace]">{smart.items[smart.activeIndex]?.slice(smart.prefix.length)}</span></div>}
        {smart && <div className="absolute z-30 min-w-52 max-w-[min(380px,90vw)] overflow-hidden rounded-lg border border-[#a17d46] bg-[#f7f4ed] text-[#221d17] shadow-xl" style={{ left: Math.min(smart.left, 400), top: smart.top + 3 }} role="listbox" aria-label={`SmartType: ${SMART_LABELS[smart.kind]}`}>
          <div className="border-b border-[#d8d0c3] px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#806f54]">SmartType · {SMART_LABELS[smart.kind]}</div>
          <div className="max-h-48 overflow-y-auto">{smart.items.map((item, index) => <button key={`${item}-${index}`} type="button" role="option" aria-selected={index === smart.activeIndex} className={`block w-full px-3 py-1 text-left text-[12pt] leading-tight [font-family:var(--font-courier-prime),Courier,monospace] ${index === smart.activeIndex ? "bg-[#245eb7] text-white" : "hover:bg-[#e5dfd3]"}`} onMouseDown={event => event.preventDefault()} onClick={() => acceptSmartType(index)}>{item}</button>)}</div>
          <div className="border-t border-[#d8d0c3] px-3 py-1 text-[10px] text-[#806f54]">↑↓ select · Tab/Enter insert · Esc close</div>
        </div>}
      </div>
    );
}
