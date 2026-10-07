"use client";
import { EditorContent, useEditor } from "@tiptap/react";
import { Mark } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { plainTextDoc, type RichText } from "@/lib/keynote/model";
const Emphasis = Mark.create({
  name: "emphasis",
  parseHTML: () => [{ tag: "em" }],
  renderHTML: () => ["em", {}, 0],
});
const extensions = [
  StarterKit.configure({
    blockquote: false,
    bold: false,
    bulletList: false,
    code: false,
    codeBlock: false,
    heading: false,
    horizontalRule: false,
    italic: false,
    listItem: false,
    orderedList: false,
    strike: false,
    link: false,
    underline: false,
    listKeymap: false,
    undoRedo: false,
  }),
  Emphasis,
];
export default function RichTextEditor({
  value,
  onChange,
  focusToken,
  disabled = false,
}: {
  disabled?: boolean;
  value: RichText;
  onChange: (value: RichText) => void;
  focusToken: number;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: value,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Slide text",
        "aria-multiline": "true",
      },
      // Plain clipboard data retains paragraph boundaries without importing Word/Docs styles.
      handlePaste(_view, event) {
        const text = event.clipboardData?.getData("text/plain");
        if (text === undefined) return false;
        event.preventDefault();
        editor?.commands.insertContent(plainTextDoc(text).content);
        return true;
      },
    },
    // Preserve oversized local input too; server validation reports it without losing text.
    onUpdate: ({ editor }) => onChange(editor.getJSON() as RichText),
  });
  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);
  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(value))
      editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => {
    if (focusToken) editor?.commands.focus();
  }, [editor, focusToken]);
  return (
    <div>
      <button
        type="button"
        onClick={() => editor?.chain().focus().toggleMark("emphasis").run()}
        disabled={!editor || disabled}
      >
        Emphasize
      </button>
      <EditorContent editor={editor} />
      <p>
        Select words and choose Emphasize. Enter starts a paragraph;
        Shift+Enter inserts a line break.
      </p>
    </div>
  );
}
