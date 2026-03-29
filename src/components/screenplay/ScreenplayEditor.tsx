"use client";

/**
 * Per-frame screenplay editor (Tiptap). Data shape (JSON string in Supabase):
 *   [{ "type": "scene_heading"|"action"|"character"|"parenthetical"|"dialogue"|"transition", "text": "..." }, ...]
 * Shortcuts: Mod+1…6 = block types; Tab = character → dialogue → action.
 */

import { EditorContent, useEditor } from "@tiptap/react";
import { UndoRedo } from "@tiptap/extensions";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import {
  getCurrentBlockType,
  screenplayEditorExtensions,
  SCREENPLAY_BLOCK_LABEL,
} from "./ScreenplayExtensions";
import {
  legacyTextToScreenplayBlocks,
  stringifyScreenplayBlocks,
  type ScreenplayBlock,
} from "@/lib/screenplay-json";
import {
  blockContentToStorage,
  storageStringToTipTapContent,
} from "@/lib/screenplay-inline-html";
import {
  applyScreenplayPaste,
  parseScreenplayPaste,
} from "@/lib/screenplay-paste";

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
};

export function ScreenplayEditor({
  initialContent,
  onChange,
  onReady,
  layout = "list",
  className = "",
  minRows = 5,
}: Props) {
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    const editorRef = useRef<Editor | null>(null);

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
            event.preventDefault();
            applyScreenplayPaste(ed, blocks);
            queueMicrotask(() => emit(ed));
            return true;
          },
        },
        onCreate: ({ editor: ed }) => {
          emit(ed);
          const t = getCurrentBlockType(ed);
          if (t) setBlockLabel(SCREENPLAY_BLOCK_LABEL[t]);
        },
        onUpdate: ({ editor: ed }) => {
          emit(ed);
        },
        onSelectionUpdate: ({ editor: ed }) => {
          const t = getCurrentBlockType(ed);
          if (t) setBlockLabel(SCREENPLAY_BLOCK_LABEL[t]);
        },
      },
      []
    );

    const readyRef = useRef(false);
    useEffect(() => {
      if (!editor) return;
      editorRef.current = editor;
      const t = getCurrentBlockType(editor);
      if (t) setBlockLabel(SCREENPLAY_BLOCK_LABEL[t]);
      if (!readyRef.current) {
        readyRef.current = true;
        onReadyRef.current?.();
      }
      return () => {
        editorRef.current = null;
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
      <div className="space-y-1" data-layout={layout}>
        <div className="flex items-center justify-between gap-2 px-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {blockLabel}
          </span>
          <span className="text-[10px] text-zinc-600">
            ⌘1–6 type · Tab cycle
          </span>
        </div>
        <EditorContent editor={editor} />
      </div>
    );
}
