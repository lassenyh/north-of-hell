import { Document } from "@tiptap/extension-document";
import { Text } from "@tiptap/extension-text";
import { Bold } from "@tiptap/extension-bold";
import { Italic } from "@tiptap/extension-italic";
import { Underline } from "@tiptap/extension-underline";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Extension, mergeAttributes, Node } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { Fragment } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/core";
import type { ScreenplayBlockType } from "@/lib/screenplay-json";
import { sceneHeadingTabInsertion } from "@/lib/screenplay-smarttype";

/**
 * screenplayBlock.attrs.blockType:
 *   Any type in SCREENPLAY_ELEMENT_OPTIONS below.
 *
 * Keyboard (Mod = ⌘ Mac / Ctrl Win):
 *   Mod+1 scene_heading, Mod+2 action, Mod+3 character, Mod+4 parenthetical,
 *   Mod+5 dialogue, Mod+6 transition
 *   Tab advances through scene-heading fields, then follows the element transitions.
 *
 * Enter: new block — after character → dialogue; after dialogue → action;
 *   transition → scene heading; otherwise → action. Mid-line: tail moves to that next block.
 */

export function nextBlockAfterTab(current: ScreenplayBlockType, empty: boolean): ScreenplayBlockType {
  if (current === "scene_heading") return "action";
  if (current === "action") return "character";
  if (current === "character") return empty ? "transition" : "parenthetical";
  if (current === "dialogue") return "parenthetical";
  if (current === "parenthetical") return "dialogue";
  if (current === "outline_1") return "outline_2";
  if (current === "outline_2") return "outline_3";
  if (current === "outline_3" || current === "summary" || current === "note") return "outline_1";
  if (current === "general") return "scene_heading";
  if (current === "shot" || current === "cast_list") return "action";
  if (current === "new_act") return "scene_heading";
  if (current === "end_of_act") return "new_act";
  if (current === "sequence") return "scene_heading";
  return "scene_heading";
}

function blockClass(t: ScreenplayBlockType): string {
  const base =
    "screenplay-block mb-1 min-h-[1.15em] px-1 py-0.5 text-[12pt] leading-[1.15] outline-none [font-family:var(--font-courier-prime),Courier,monospace]";
  const by: Record<ScreenplayBlockType, string> = {
    general: `${base} text-zinc-100 text-center`,
    scene_heading: `${base} uppercase text-zinc-100 text-center`,
    action: `${base} text-zinc-100 text-center`,
    character: `${base} uppercase text-center text-zinc-100`,
    dialogue: `${base} text-center text-zinc-100 max-w-[42ch] mx-auto w-full px-2`,
    parenthetical: `${base} text-center text-zinc-300 max-w-[36ch] mx-auto w-full px-2`,
    transition: `${base} uppercase text-right text-zinc-200 pr-2`,
    shot: `${base} uppercase text-zinc-100 text-center`,
    cast_list: `${base} text-zinc-100 text-center`,
    new_act: `${base} uppercase text-zinc-100 text-center`,
    sequence: `${base} uppercase text-zinc-100 text-center`,
    end_of_act: `${base} uppercase text-zinc-100 text-center`,
    summary: `${base} text-zinc-100 text-center`,
    outline_1: `${base} text-zinc-100 text-center`,
    outline_2: `${base} text-zinc-100 text-center`,
    outline_3: `${base} text-zinc-100 text-center`,
    note: `${base} text-zinc-100 text-center`,
  };
  return by[t];
}

export function nextBlockAfterEnter(current: ScreenplayBlockType): ScreenplayBlockType {
  if (current === "character") return "dialogue";
  if (current === "dialogue") return "action";
  if (current === "parenthetical") return "dialogue";
  if (current === "transition") return "scene_heading";
  if (current === "general") return "general";
  if (current === "shot" || current === "cast_list") return "action";
  if (current === "new_act") return "scene_heading";
  if (current === "end_of_act") return "new_act";
  if (current === "summary") return "summary";
  if (current === "outline_1" || current === "outline_2" || current === "outline_3") return "summary";
  if (current === "sequence" || current === "note") return "action";
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

function newBlockContent(schema: Editor["schema"], type: ScreenplayBlockType) {
  return type === "parenthetical" ? Fragment.from(schema.text("()")) : emptyBlockContent(schema);
}

/** Change the current paragraph without losing its text or selection. */
export function setScreenplayElement(editor: Editor, type: ScreenplayBlockType): boolean {
  const { state, view } = editor;
  const { $from } = state.selection;
  const depth = findScreenplayDepth($from);
  if (depth == null) return false;
  const start = $from.before(depth);
  const block = state.doc.nodeAt(start);
  if (!block) return false;
  const tr = state.tr.setNodeMarkup(start, undefined, { ...block.attrs, blockType: type });
  if (type === "parenthetical" && !block.textContent.trim()) {
    tr.replaceWith(start + 1, start + block.nodeSize - 1, state.schema.text("()"));
    tr.setSelection(TextSelection.create(tr.doc, start + 2));
  }
  view.dispatch(tr);
  view.focus();
  return true;
}

export const ScreenplayKeymap = Extension.create({
  name: "screenplayKeymap",

  addKeyboardShortcuts() {
    const extra = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
      ? "Mod-Control"
      : "Mod-Shift";
    return {
      Enter: () => {
        const { $from } = this.editor.state.selection;
        const depth = findScreenplayDepth($from);
        if (depth == null) return false;
        return insertFollowingBlock(this.editor, nextBlockAfterEnter($from.node(depth).attrs.blockType as ScreenplayBlockType));
      },

      Tab: () => {
        const editor = this.editor;
        const { $from } = editor.state.selection;
        const depth = findScreenplayDepth($from);
        if (depth == null) return false;
        const t = $from.node(depth).attrs.blockType as ScreenplayBlockType;
        if (t === "scene_heading" && editor.state.selection.empty && $from.pos === $from.end(depth)) {
          const insertion = sceneHeadingTabInsertion($from.node(depth).textContent);
          if (insertion !== null) return insertion ? editor.commands.insertContent(insertion) : true;
        }
        const next = nextBlockAfterTab(t, $from.node(depth).textContent.trim().length === 0);
        if (!$from.node(depth).textContent.trim()) return setScreenplayElement(editor, next);
        return insertFollowingBlock(editor, next);
      },

      "Mod-1": () => setScreenplayElement(this.editor, "scene_heading"),
      "Mod-0": () => setScreenplayElement(this.editor, "general"),
      "Mod-2": () => setScreenplayElement(this.editor, "action"),
      "Mod-3": () => setScreenplayElement(this.editor, "character"),
      "Mod-4": () => setScreenplayElement(this.editor, "parenthetical"),
      "Mod-5": () => setScreenplayElement(this.editor, "dialogue"),
      "Mod-6": () => setScreenplayElement(this.editor, "transition"),
      "Mod-7": () => setScreenplayElement(this.editor, "shot"),
      "Mod-8": () => setScreenplayElement(this.editor, "cast_list"),
      "Mod-9": () => setScreenplayElement(this.editor, "new_act"),
      [`${extra}-8`]: () => setScreenplayElement(this.editor, "sequence"),
      [`${extra}-9`]: () => setScreenplayElement(this.editor, "end_of_act"),
      [`${extra}-0`]: () => setScreenplayElement(this.editor, "summary"),
      [`${extra}-1`]: () => setScreenplayElement(this.editor, "outline_1"),
      [`${extra}-2`]: () => setScreenplayElement(this.editor, "outline_2"),
      [`${extra}-3`]: () => setScreenplayElement(this.editor, "outline_3"),
      [`${extra}-4`]: () => setScreenplayElement(this.editor, "note"),
    };
  },
});

function insertFollowingBlock(editor: Editor, nextType: ScreenplayBlockType): boolean {
  const { state, view } = editor;
  const { $from } = state.selection;
  const depth = findScreenplayDepth($from);
  if (depth == null) return false;
  const blockStart = $from.before(depth);
  const block = state.doc.nodeAt(blockStart);
  if (!block) return false;
  const innerEnd = $from.end(depth);
  let innerFrom = $from.pos;
  const tr = state.tr;
  const schema = state.schema;
  if (block.attrs.blockType === "parenthetical" && state.doc.textBetween(innerFrom, innerEnd).trim() === ")") innerFrom += 1;
  if (innerFrom >= innerEnd) {
    const insertAt = blockStart + block.nodeSize;
    tr.insert(insertAt, schema.nodes.screenplayBlock.create({ blockType: nextType }, newBlockContent(schema, nextType)));
    tr.setSelection(TextSelection.create(tr.doc, insertAt + (nextType === "parenthetical" ? 2 : 1)));
  } else {
    const slice = state.doc.slice(innerFrom, innerEnd);
    tr.delete(innerFrom, innerEnd);
    const shrunk = tr.doc.nodeAt(blockStart);
    if (!shrunk) return false;
    const insertAt = blockStart + shrunk.nodeSize;
    const content = nextType === "parenthetical" && !slice.content.textBetween(0, slice.content.size).trim()
      ? newBlockContent(schema, nextType)
      : slice.content.size ? slice.content : emptyBlockContent(schema);
    tr.insert(insertAt, schema.nodes.screenplayBlock.create({ blockType: nextType }, content));
    tr.setSelection(TextSelection.create(tr.doc, insertAt + (nextType === "parenthetical" && content.textBetween(0, content.size) === "()" ? 2 : 1)));
  }
  view.dispatch(tr);
  return true;
}

export const SCREENPLAY_BLOCK_LABEL: Record<ScreenplayBlockType, string> = {
  general: "General",
  scene_heading: "Scene Heading",
  action: "Action",
  character: "Character",
  parenthetical: "Parenthetical",
  dialogue: "Dialogue",
  transition: "Transition",
  shot: "Shot",
  cast_list: "Cast List",
  new_act: "New Act",
  sequence: "Sequence",
  end_of_act: "End of Act",
  summary: "Summary",
  outline_1: "Outline 1",
  outline_2: "Outline 2",
  outline_3: "Outline 3",
  note: "Note",
};

export const SCREENPLAY_ELEMENT_OPTIONS: { type: ScreenplayBlockType; label: string; key: string }[] = [
  { type: "general", label: "General", key: "G" },
  { type: "scene_heading", label: "Scene Heading", key: "S" },
  { type: "action", label: "Action", key: "A" },
  { type: "character", label: "Character", key: "C" },
  { type: "parenthetical", label: "Parenthetical", key: "P" },
  { type: "dialogue", label: "Dialogue", key: "D" },
  { type: "transition", label: "Transition", key: "T" },
  { type: "shot", label: "Shot", key: "H" },
  { type: "cast_list", label: "Cast List", key: "L" },
  { type: "new_act", label: "New Act", key: "N" },
  { type: "sequence", label: "Sequence", key: "Q" },
  { type: "end_of_act", label: "End of Act", key: "E" },
  { type: "summary", label: "Summary", key: "O" },
  { type: "outline_1", label: "Outline 1", key: "1" },
  { type: "outline_2", label: "Outline 2", key: "2" },
  { type: "outline_3", label: "Outline 3", key: "3" },
  { type: "note", label: "Note", key: "4" },
];

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
    Underline,
    HardBreak.configure({
      HTMLAttributes: { class: "screenplay-hard-break" },
    }),
    ScreenplayKeymap,
  ];
}
