import { Document } from "@tiptap/extension-document";
import { Text } from "@tiptap/extension-text";
import { Bold } from "@tiptap/extension-bold";
import { Italic } from "@tiptap/extension-italic";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Extension, mergeAttributes, Node } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { Fragment } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/core";
import type { ScreenplayBlockType } from "@/lib/screenplay-json";

/**
 * screenplayBlock.attrs.blockType:
 *   scene_heading | action | character | parenthetical | dialogue | transition
 *
 * Keyboard (Mod = ⌘ Mac / Ctrl Win):
 *   Mod+1 scene_heading, Mod+2 action, Mod+3 character, Mod+4 dialogue,
 *   Mod+5 parenthetical, Mod+6 transition
 *   Tab: character → dialogue → action (only cycles these three)
 *
 * Enter: new block — after character → dialogue; after dialogue → action;
 *   otherwise → action. Mid-line: tail moves to that next block.
 */

const TAB_CYCLE: ScreenplayBlockType[] = ["character", "dialogue", "action"];

function blockClass(t: ScreenplayBlockType): string {
  const base =
    "screenplay-block mb-1 min-h-[1.15em] px-1 py-0.5 text-[12pt] leading-[1.15] outline-none [font-family:var(--font-courier-prime),Courier,monospace]";
  const by: Record<ScreenplayBlockType, string> = {
    scene_heading: `${base} font-bold uppercase tracking-[0.12em] text-zinc-100 text-center`,
    action: `${base} text-zinc-100 text-center`,
    character: `${base} uppercase text-center text-zinc-100`,
    dialogue: `${base} italic text-center text-zinc-100 max-w-[42ch] mx-auto w-full px-2`,
    parenthetical: `${base} italic text-center text-zinc-300 max-w-[36ch] mx-auto w-full px-2`,
    transition: `${base} uppercase text-right text-zinc-200 pr-2`,
  };
  return by[t];
}

export function nextBlockAfterEnter(current: ScreenplayBlockType): ScreenplayBlockType {
  if (current === "character") return "dialogue";
  if (current === "dialogue") return "action";
  if (current === "parenthetical") return "dialogue";
  return "action";
}

function findScreenplayDepth($pos: {
  depth: number;
  node: (d: number) => { type: { name: string } };
}): number | null {
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === "screenplayBlock") return d;
  }
  return null;
}

export const ScreenplayDocument = Document.extend({
  content: "screenplayBlock+",
});

export const ScreenplayBlock = Node.create({
  name: "screenplayBlock",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      blockType: {
        default: "action" as ScreenplayBlockType,
        parseHTML: (el) =>
          (el.getAttribute("data-block-type") as ScreenplayBlockType) || "action",
        renderHTML: (attrs) => ({
          "data-block-type": attrs.blockType,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-block-type]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const t = node.attrs.blockType as ScreenplayBlockType;
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: blockClass(t) }),
      0,
    ];
  },
});

function emptyBlockContent(schema: Editor["schema"]) {
  return Fragment.from(schema.nodes.hardBreak.create());
}

export const ScreenplayKeymap = Extension.create({
  name: "screenplayKeymap",

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const editor = this.editor;
        const { state, view } = editor;
        const { $from } = state.selection;
        const depth = findScreenplayDepth($from);
        if (depth == null) return false;

        const blockType = $from.node(depth).attrs.blockType as ScreenplayBlockType;
        const nextType = nextBlockAfterEnter(blockType);
        const blockStart = $from.before(depth);
        const block = state.doc.nodeAt(blockStart);
        if (!block) return false;

        const innerEnd = $from.end(depth);
        const innerFrom = $from.pos;
        const atEnd = innerFrom >= innerEnd - 1;

        const tr = state.tr;
        const schema = state.schema;

        if (atEnd) {
          const insertAt = blockStart + block.nodeSize;
          const nb = schema.nodes.screenplayBlock.create(
            { blockType: nextType },
            emptyBlockContent(schema)
          );
          tr.insert(insertAt, nb);
          tr.setSelection(TextSelection.create(tr.doc, insertAt + 1));
        } else {
          const slice = state.doc.slice(innerFrom, innerEnd);
          tr.delete(innerFrom, innerEnd);
          const shrunk = tr.doc.nodeAt(blockStart);
          if (!shrunk) return false;
          const insertAt = blockStart + shrunk.nodeSize;
          const inner = slice.content.size ? slice.content : emptyBlockContent(schema);
          const nb = schema.nodes.screenplayBlock.create({ blockType: nextType }, inner);
          tr.insert(insertAt, nb);
          tr.setSelection(TextSelection.create(tr.doc, insertAt + 1));
        }
        view.dispatch(tr);
        return true;
      },

      Tab: () => {
        const editor = this.editor;
        const { $from } = editor.state.selection;
        const depth = findScreenplayDepth($from);
        if (depth == null) return false;
        const t = $from.node(depth).attrs.blockType as ScreenplayBlockType;
        const i = TAB_CYCLE.indexOf(t);
        const next = i >= 0 ? TAB_CYCLE[(i + 1) % TAB_CYCLE.length] : "character";
        return editor
          .chain()
          .focus()
          .updateAttributes("screenplayBlock", { blockType: next })
          .run();
      },

      "Mod-1": () =>
        this.editor
          .chain()
          .focus()
          .updateAttributes("screenplayBlock", { blockType: "scene_heading" })
          .run(),
      "Mod-2": () =>
        this.editor
          .chain()
          .focus()
          .updateAttributes("screenplayBlock", { blockType: "action" })
          .run(),
      "Mod-3": () =>
        this.editor
          .chain()
          .focus()
          .updateAttributes("screenplayBlock", { blockType: "character" })
          .run(),
      "Mod-4": () =>
        this.editor
          .chain()
          .focus()
          .updateAttributes("screenplayBlock", { blockType: "dialogue" })
          .run(),
      "Mod-5": () =>
        this.editor
          .chain()
          .focus()
          .updateAttributes("screenplayBlock", { blockType: "parenthetical" })
          .run(),
      "Mod-6": () =>
        this.editor
          .chain()
          .focus()
          .updateAttributes("screenplayBlock", { blockType: "transition" })
          .run(),
    };
  },
});

export const SCREENPLAY_BLOCK_LABEL: Record<ScreenplayBlockType, string> = {
  scene_heading: "Scene Heading",
  action: "Action",
  character: "Character",
  parenthetical: "Parenthetical",
  dialogue: "Dialogue",
  transition: "Transition",
};

export function getCurrentBlockType(editor: Editor | null): ScreenplayBlockType | null {
  if (!editor) return null;
  const { $from } = editor.state.selection;
  const depth = findScreenplayDepth($from);
  if (depth == null) return null;
  return $from.node(depth).attrs.blockType as ScreenplayBlockType;
}

export function screenplayEditorExtensions() {
  return [
    ScreenplayDocument,
    ScreenplayBlock,
    Text,
    Bold,
    Italic,
    HardBreak.configure({
      HTMLAttributes: { class: "screenplay-hard-break" },
    }),
    ScreenplayKeymap,
  ];
}
