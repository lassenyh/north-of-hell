"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import type { Editor } from "@tiptap/core";
import { ScreenplayEditor } from "@/components/screenplay/ScreenplayEditor";
import { ScreenplayToolbar } from "@/components/screenplay/ScreenplayToolbar";
import { StoryboardDocumentView, SectionContent, cleanTextHtml } from "./StoryboardDocumentView";
import { duplicateChapter, duplicateSection, moveImageToSlot, newId, putImageInSlot, type Chapter, type Section, type StoryboardDocument, type StoryboardState } from "@/lib/storyboard/model";
import { saveDraftAction, publishDraftAction } from "@/app/admin/storyboard/actions";
import "./storyboard-editor.css";

type Drag = { kind: "chapter"; id: string } | { kind: "section"; id: string } | { kind: "image"; id: string; sectionId: string };
const capacity = { single: 1, "2x2": 4, "2x3": 6, "3x3": 9 } as const;
const sectionNames = { text: "Regular text", screenplay: "Screenplay", images: "Images" } as const;

function RichTextEditor({ html, onChange, onFocus }: { html: string; onChange: (html: string) => void; onFocus: (editor: Editor) => void }) {
  const onChangeRef = useRef(onChange);
  const onFocusRef = useRef(onFocus);
  useEffect(() => { onChangeRef.current = onChange; onFocusRef.current = onFocus; }, [onChange, onFocus]);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Underline],
    content: cleanTextHtml(html),
    editorProps: { attributes: { class: "storyboard-text-input", "aria-label": "Edit text" } },
    onCreate: ({ editor: current }) => onFocusRef.current(current),
    onUpdate: ({ editor: current }) => onChangeRef.current(current.getHTML()),
    onFocus: ({ editor: current }) => onFocusRef.current(current),
  }, []);
  return <EditorContent editor={editor} />;
}

export default function StoryboardEditor({ initial, library }: { initial: StoryboardState; library: string[] }) {
  const [tab, setTab] = useState<"finished" | "editor">("editor");
  const [document, setDocument] = useState(initial.draft);
  const [published, setPublished] = useState(initial.published);
  const [version, setVersion] = useState(initial.draftVersion);
  const [publishedVersion, setPublishedVersion] = useState(initial.publishedVersion);
  const [publishedAt, setPublishedAt] = useState(initial.publishedAt);
  const [savedJson, setSavedJson] = useState(JSON.stringify(initial.draft));
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);
  const [textEditor, setTextEditor] = useState<Editor | null>(null);
  const [manusEditor, setManusEditor] = useState<Editor | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const dirty = JSON.stringify(document) !== savedJson;
  const selectedSection = document.chapters.flatMap(ch => ch.sections).find(sec => sec.id === selectedId);
  const screenplayBlocks = document.chapters.flatMap(ch => ch.sections.flatMap(sec => sec.kind === "screenplay" ? sec.blocks : []));

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!selectedId) return;
    const layer = globalThis.document.getElementById(`layer-${selectedId}`);
    layer?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    globalThis.document.getElementById(`edit-${selectedId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId, expandedChapters]);
  const status = dirty ? "Unsaved changes" : version === 0 ? "No saved draft" : publishedVersion === version ? "Published version" : "Saved draft";

  function select(id: string) {
    if (id !== selectedId) setTextEditor(null);
    const owner = document.chapters.find(ch => ch.id === id || ch.sections.some(s => s.id === id));
    if (owner) setExpandedChapters(current => current.includes(owner.id) ? current : [...current, owner.id]);
    setSelectedId(id);
  }

  function change(fn: (doc: StoryboardDocument) => void) {
    setDocument(previous => { const next = structuredClone(previous); fn(next); return next; });
    setError(""); setFlash("");
  }
  function updateChapter(id: string, fn: (ch: Chapter) => void) { change(doc => { const ch = doc.chapters.find(c => c.id === id); if (ch) fn(ch); }); }
  function updateSection(id: string, fn: (section: Section) => void) { change(doc => { const section = doc.chapters.flatMap(c => c.sections).find(s => s.id === id); if (section) fn(section); }); }
  function addChapter() {
    const id = newId();
    change(doc => { doc.chapters.push({ id, title: "New chapter", sections: [] }); });
    setSelectedId(id);
    setExpandedChapters(current => [...current, id]);
  }
  function addSection(chapterId: string, kind: Section["kind"]) {
    const id = newId();
    change(doc => {
      const ch = doc.chapters.find(c => c.id === chapterId);
      if (!ch) return;
      const section: Section = kind === "text" ? { id, kind, title: "New text section", html: "<p></p>", align: "left", size: 16 }
        : kind === "screenplay" ? { id, kind, title: "New screenplay section", blocks: [{ type: "scene_heading", text: "" }] }
        : { id, kind, title: "New image section", layout: "single", images: [] };
      ch.sections.push(section);
    });
    setSelectedId(id);
    setExpandedChapters(current => current.includes(chapterId) ? current : [...current, chapterId]);
  }
  function duplicate(id: string) {
    change(doc => {
      const chapterIndex = doc.chapters.findIndex(c => c.id === id);
      if (chapterIndex >= 0) { const copy = duplicateChapter(doc.chapters[chapterIndex]); doc.chapters.splice(chapterIndex + 1, 0, copy); setExpandedChapters(current => [...current, copy.id]); setSelectedId(copy.id); return; }
      for (const ch of doc.chapters) {
        const index = ch.sections.findIndex(s => s.id === id);
        if (index >= 0) { const copy = duplicateSection(ch.sections[index]); ch.sections.splice(index + 1, 0, copy); setSelectedId(copy.id); return; }
      }
    });
  }
  function remove(id: string) {
    const isScreenplay = document.chapters.some(ch => ch.sections.some(section => section.id === id && section.kind === "screenplay"));
    if (!window.confirm(isScreenplay ? "Delete this screenplay section and its content?" : "Delete this item and its content?")) return;
    change(doc => {
      const index = doc.chapters.findIndex(c => c.id === id);
      if (index >= 0) doc.chapters.splice(index, 1);
      else for (const ch of doc.chapters) ch.sections = ch.sections.filter(s => s.id !== id);
    });
    setSelectedId(null);
  }
  function moveChapter(id: string, targetId: string, after: boolean) {
    if (id === targetId) return;
    change(doc => {
      const item = doc.chapters.find(c => c.id === id);
      if (!item) return;
      doc.chapters = doc.chapters.filter(c => c.id !== id);
      const target = doc.chapters.findIndex(c => c.id === targetId);
      doc.chapters.splice(target + (after ? 1 : 0), 0, item);
    });
  }
  function moveSection(id: string, chapterId: string, targetId?: string, after = false) {
    if (id === targetId) return;
    change(doc => {
      const item = doc.chapters.flatMap(c => c.sections).find(s => s.id === id);
      const destination = doc.chapters.find(c => c.id === chapterId);
      if (!item || !destination) return;
      for (const ch of doc.chapters) ch.sections = ch.sections.filter(s => s.id !== id);
      const target = targetId ? destination.sections.findIndex(s => s.id === targetId) : destination.sections.length;
      destination.sections.splice(Math.max(0, target + (targetId && after ? 1 : 0)), 0, item);
    });
    setExpandedChapters(current => current.includes(chapterId) ? current : [...current, chapterId]);
  }
  function startDrag(event: React.DragEvent, item: Drag) { drag.current = item; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.id); }
  function allowDrop(event: React.DragEvent) { if (drag.current) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }
  function dropChapter(event: React.DragEvent, chapterId: string) {
    event.preventDefault(); event.stopPropagation();
    const item = drag.current; drag.current = null;
    if (item?.kind === "chapter") moveChapter(item.id, chapterId, event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2);
    if (item?.kind === "section") moveSection(item.id, chapterId);
  }
  function dropSection(event: React.DragEvent, chapterId: string, sectionId: string) {
    event.preventDefault(); event.stopPropagation();
    const item = drag.current; drag.current = null;
    if (item?.kind === "section") moveSection(item.id, chapterId, sectionId, event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2);
  }
  function moveByButton(id: string, direction: -1 | 1) {
    const ci = document.chapters.findIndex(c => c.id === id);
    if (ci >= 0) {
      const target = document.chapters[ci + direction]; if (target) moveChapter(id, target.id, direction === 1);
      return;
    }
    const owner = document.chapters.find(c => c.sections.some(s => s.id === id));
    if (!owner) return;
    const si = owner.sections.findIndex(s => s.id === id);
    const target = owner.sections[si + direction];
    if (target) moveSection(id, owner.id, target.id, direction === 1);
  }
  async function save() {
    if (busy || !dirty && version > 0) return;
    const snapshot = structuredClone(document); const serialized = JSON.stringify(snapshot);
    setBusy("save"); setError(""); setFlash("");
    const result = await saveDraftAction(snapshot, version);
    setBusy(null);
    if (result.ok) { setVersion(result.version); setSavedJson(serialized); setFlash("Draft saved"); }
    else setError(result.error);
  }
  async function publish() {
    if (busy || dirty || version === 0) return;
    setBusy("publish"); setError(""); setFlash("");
    const result = await publishDraftAction(version);
    setBusy(null);
    if (result.ok) { setPublished(structuredClone(document)); setPublishedVersion(result.version); setPublishedAt(result.publishedAt); setFlash("Published version updated"); }
    else setError(result.error);
  }
  function command(name: "bold" | "italic" | "underline" | "bulletList" | "orderedList") {
    if (!textEditor) return;
    const chain = textEditor.chain().focus();
    if (name === "bold") chain.toggleBold().run();
    if (name === "italic") chain.toggleItalic().run();
    if (name === "underline") chain.toggleUnderline().run();
    if (name === "bulletList") chain.toggleBulletList().run();
    if (name === "orderedList") chain.toggleOrderedList().run();
  }
  const sectionRow = (section: Section, chapter: Chapter) => (
    <div key={section.id} id={`layer-${section.id}`} className={`sb-layer-row sb-section-row ${selectedId === section.id ? "is-selected" : ""}`}
      onDragOver={allowDrop} onDrop={event => dropSection(event, chapter.id, section.id)}>
      <button type="button" className="sb-grip" draggable onDragStart={event => startDrag(event, { kind: "section", id: section.id })} aria-label={`Drag ${section.title}`}>⋮⋮</button>
      <button type="button" className="sb-layer-label" title={section.title} onClick={() => select(section.id)}><span>{sectionNames[section.kind]}</span>{section.title}</button>
      <button type="button" title="Move up" aria-label={`Move ${section.title} up`} onClick={() => moveByButton(section.id, -1)}>↑</button>
      <button type="button" title="Move down" aria-label={`Move ${section.title} down`} onClick={() => moveByButton(section.id, 1)}>↓</button>
      <button type="button" title="Duplicate" aria-label={`Duplicate ${section.title}`} onClick={() => duplicate(section.id)}>⧉</button>
      <button type="button" title="Delete" aria-label={`Delete ${section.title}`} onClick={() => remove(section.id)}>×</button>
    </div>
  );

  const textToolbar = <div className="sb-formatbar sb-text-toolbar" role="toolbar" aria-label="Text formatting">
    <span>Text</span><select aria-label="Style" disabled={!textEditor} value={textEditor?.isActive("heading", { level: 2 }) ? "h2" : textEditor?.isActive("heading", { level: 3 }) ? "h3" : "p"} onChange={event => { const ch = textEditor?.chain().focus(); if (event.target.value === "p") ch?.setParagraph().run(); if (event.target.value === "h2") ch?.toggleHeading({ level: 2 }).run(); if (event.target.value === "h3") ch?.toggleHeading({ level: 3 }).run(); }}><option value="p">Regular text</option><option value="h2">Heading</option><option value="h3">Subheading</option></select>
    <select aria-label="Font size" value={selectedSection?.kind === "text" ? selectedSection.size : 16} onChange={event => selectedSection && updateSection(selectedSection.id, s => { if (s.kind === "text") s.size = Number(event.target.value); })}>{[12,14,16,18,20,24,30,36].map(size => <option key={size} value={size}>{size} pt</option>)}</select>
    <span className="sb-divider" />{([ ["bold","Bold","B"], ["italic","Italic","I"], ["underline","Underline","U"], ["bulletList","Bullet list","•"], ["orderedList","Numbered list","1."] ] as const).map(([name,label,icon]) => <button type="button" key={name} title={label} aria-label={label} disabled={!textEditor} onMouseDown={event => event.preventDefault()} onClick={() => command(name)}>{icon}</button>)}
    <span className="sb-divider" />{([ ["left","Align left","≡"], ["center","Align center","☰"], ["right","Align right","≡"] ] as const).map(([align,label,icon]) => <button type="button" key={align} title={label} aria-label={label} aria-pressed={selectedSection?.kind === "text" && selectedSection.align === align} onClick={() => selectedSection && updateSection(selectedSection.id, s => { if (s.kind === "text") s.align = align; })}>{icon}</button>)}
  </div>;

  return <div className="sb-app">
    <header className="sb-topbar">
      <div><p className="sb-kicker">NORTH OF HELL / STORYBOARD</p><h1>Storyboard studio</h1></div>
      <nav className="sb-tabs" aria-label="Storyboard view"><button type="button" aria-current={tab === "finished" ? "page" : undefined} onClick={() => setTab("finished")}>Finished page</button><button type="button" aria-current={tab === "editor" ? "page" : undefined} onClick={() => setTab("editor")}>Editor</button></nav>
      <div className="sb-save-actions"><span className={`sb-status ${dirty ? "dirty" : ""}`} role="status">{status}</span><button type="button" onClick={save} disabled={!!busy || !dirty && version > 0}>{busy === "save" ? "Saving…" : "Save draft"}</button><button type="button" className="primary" onClick={publish} disabled={!!busy || dirty || version === 0 || publishedVersion === version}>{busy === "publish" ? "Publishing…" : "Publish"}</button></div>
    </header>
    {(error || flash) && <div className={error ? "sb-message error" : "sb-message"} role={error ? "alert" : "status"}>{error || flash}</div>}
    {tab === "finished" ? <div className="sb-finished"><div className="sb-finished-note"><span>{published ? `Published ${publishedAt ? new Date(publishedAt).toLocaleString("en-US") : "version"}` : "No published version yet"}</span><Link href="/storyboard" target="_blank">Open reader page ↗</Link></div>{published ? <StoryboardDocumentView document={published} /> : <p className="sb-empty">Save the draft and select Publish to show it here.</p>}</div> : <>
      <div className="sb-workspace">
        <aside className="sb-layers"><div className="sb-panel-heading"><h2>Layers</h2><button type="button" onClick={addChapter}>+ Chapter</button></div>
          {document.chapters.length === 0 && <p className="sb-muted">Start with a chapter.</p>}
          {document.chapters.map((chapter, index) => <div key={chapter.id} id={`layer-${chapter.id}`} className="sb-layer-chapter" onDragOver={allowDrop} onDrop={event => dropChapter(event, chapter.id)}>
            <div className={`sb-layer-row ${selectedId === chapter.id ? "is-selected" : ""}`}>
              <button type="button" className="sb-grip" draggable onDragStart={event => startDrag(event, { kind: "chapter", id: chapter.id })} aria-label={`Drag chapter ${chapter.title}`}>⋮⋮</button>
              <button type="button" className="sb-expand" aria-label={`${expandedChapters.includes(chapter.id) ? "Hide" : "Show"} sections in ${chapter.title}`} aria-expanded={expandedChapters.includes(chapter.id)} onClick={() => setExpandedChapters(current => current.includes(chapter.id) ? current.filter(id => id !== chapter.id) : [...current, chapter.id])}>{expandedChapters.includes(chapter.id) ? "▾" : "▸"}</button>
              <button type="button" className="sb-layer-label" title={chapter.title} onClick={() => select(chapter.id)}><span>CHAPTER {String(index+1).padStart(2,"0")}</span>{chapter.title}</button>
              <button type="button" title="Move up" aria-label={`Move chapter ${chapter.title} up`} onClick={() => moveByButton(chapter.id,-1)}>↑</button><button type="button" title="Move down" aria-label={`Move chapter ${chapter.title} down`} onClick={() => moveByButton(chapter.id,1)}>↓</button><button type="button" title="Duplicate" aria-label={`Duplicate chapter ${chapter.title}`} onClick={() => duplicate(chapter.id)}>⧉</button><button type="button" title="Delete" aria-label={`Delete chapter ${chapter.title}`} onClick={() => remove(chapter.id)}>×</button>
            </div>{expandedChapters.includes(chapter.id) && chapter.sections.map(section => sectionRow(section,chapter))}
          </div>)}
        </aside>
        <main className="sb-canvas"><div className="sb-canvas-top"><label>Document title<input aria-label="Document title" value={document.title} onChange={event => change(doc => { doc.title = event.target.value; })} /></label><span>{document.chapters.length} chapters</span></div>
          {document.chapters.map((chapter, index) => <article key={chapter.id} id={`edit-${chapter.id}`} className={`sb-edit-chapter ${selectedId === chapter.id ? "is-selected" : ""}`} onDragOver={allowDrop} onDrop={event => dropChapter(event,chapter.id)} onClick={() => select(chapter.id)}>
            <div className="sb-edit-heading"><button type="button" className="sb-grip" draggable onDragStart={event => startDrag(event,{kind:"chapter",id:chapter.id})} aria-label={`Drag chapter ${chapter.title}`}>⋮⋮</button><span>CHAPTER {String(index+1).padStart(2,"0")}</span><button type="button" onClick={() => duplicate(chapter.id)}>Duplicate</button><button type="button" onClick={() => remove(chapter.id)}>Delete</button></div>
            {selectedId === chapter.id ? <input className="sb-title-input" aria-label="Chapter title" value={chapter.title} onChange={event => updateChapter(chapter.id,c => { c.title = event.target.value; })} onClick={event => event.stopPropagation()} /> : <h2>{chapter.title}</h2>}
            {expandedChapters.includes(chapter.id) ? chapter.sections.map(section => <section key={section.id} id={`edit-${section.id}`} className={`sb-edit-section ${selectedId === section.id ? "is-selected" : ""}`} onDragOver={allowDrop} onDrop={event => dropSection(event,chapter.id,section.id)} onClick={event => { event.stopPropagation(); if (selectedId !== section.id) select(section.id); }}>
              <div className="sb-edit-section-head"><button type="button" className="sb-grip" draggable onDragStart={event => startDrag(event,{kind:"section",id:section.id})} aria-label={`Drag ${section.title}`}>⋮⋮</button><span>{sectionNames[section.kind]}</span><button type="button" onClick={() => duplicate(section.id)}>Duplicate</button><button type="button" onClick={() => remove(section.id)}>Delete</button></div>
              {selectedId === section.id ? <input className="sb-section-title-input" aria-label="Section title" value={section.title} onChange={event => updateSection(section.id,s => { s.title = event.target.value; })} /> : <h3>{section.title}</h3>}
              {selectedId === section.id && section.kind === "text" && textToolbar}
              {selectedId === section.id && section.kind === "screenplay" && <div className="sb-formatbar sb-screenplay-toolbar" role="toolbar" aria-label="Screenplay toolbar"><ScreenplayToolbar editor={manusEditor} /></div>}
              {selectedId !== section.id ? <SectionContent section={section} showEmptyImageSlots /> : section.kind === "text" ? <div className="storyboard-prose" style={{textAlign:section.align,fontSize:`${section.size}px`}}><RichTextEditor key={section.id} html={section.html} onChange={html => { if (html !== section.html) updateSection(section.id,s => { if (s.kind === "text") s.html = html; }); }} onFocus={setTextEditor} /></div> : section.kind === "screenplay" ? <div className="sb-script-editor"><ScreenplayEditor key={section.id} initialContent={JSON.stringify(section.blocks)} smartTypeBlocks={screenplayBlocks} onEditorChange={setManusEditor} onChange={raw => { if (raw !== JSON.stringify(section.blocks)) updateSection(section.id,s => { if (s.kind === "screenplay") s.blocks = JSON.parse(raw); }); }} minRows={7} /></div> : <ImageSectionEditor section={section} library={library} onChange={fn => updateSection(section.id,s => { if (s.kind === "images") fn(s); })} uploading={uploading} setUploading={setUploading} startDrag={startDrag} drag={drag} />}
            </section>) : <button type="button" className="sb-show-sections" onClick={event => {event.stopPropagation();setExpandedChapters(current => [...current,chapter.id]);}}>{chapter.sections.length} sections · Show chapter</button>}
            <div className="sb-canvas-add"><button type="button" onClick={event => {event.stopPropagation();addSection(chapter.id,"text")}}>+ Text</button><button type="button" onClick={event => {event.stopPropagation();addSection(chapter.id,"screenplay")}}>+ Screenplay</button><button type="button" onClick={event => {event.stopPropagation();addSection(chapter.id,"images")}}>+ Images</button></div>
          </article>)}
          <button type="button" className="sb-add-chapter" onClick={addChapter}>+ Add chapter</button>
        </main>
      </div>
    </>}
  </div>;
}

function ImageSectionEditor({ section, library, onChange, uploading, setUploading, startDrag, drag }: {
  section: Extract<Section,{kind:"images"}>; library: string[]; onChange: (fn: (section: Extract<Section,{kind:"images"}>) => void) => void;
  uploading: string | null; setUploading: (value: string | null) => void;
  startDrag: (event: React.DragEvent,item:Drag) => void; drag: React.RefObject<Drag | null>;
}) {
  const total = capacity[section.layout];
  const [pickTarget, setPickTarget] = useState<number | null>(null);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryChapter, setLibraryChapter] = useState("");
  const [libraryLimit, setLibraryLimit] = useState(18);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const libraryChapters = [...new Set(library.map(src => decodeURIComponent(src.split("/")[2] || "Other")))];
  const matches = library.filter(src => (!libraryChapter || decodeURIComponent(src.split("/")[2] || "Other") === libraryChapter) && decodeURIComponent(src).toLocaleLowerCase("en-US").includes(libraryQuery.trim().toLocaleLowerCase("en-US")));
  function imageLabel(src: string) {
    const parts = decodeURIComponent(src).split("/");
    const chapter = parts.length > 3 ? parts[2] : "Image";
    const frame = parts.at(-1)?.match(/(?:NOH_color_)?0*(\d+)_cropped/i)?.[1];
    return frame ? `${chapter} · Frame ${frame}` : parts.at(-1)?.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") || "Image";
  }
  function pickImage(src: string) {
    if (pickTarget === null) return;
    onChange(s => putImageInSlot(s, pickTarget, src));
    setPickTarget(null);
  }
  function setLayout(value: typeof section.layout) {
    if (section.images.some(image => image.slot >= capacity[value]) && !window.confirm("The new layout has fewer slots. Images and descriptions outside the new slots will be removed. Continue?")) return;
    onChange(s => { s.layout = value; s.images = s.images.filter(image => image.slot < capacity[value]); });
  }
  const uploadKey = (slot: number) => `${section.id}:${slot}`;
  async function uploadFile(file: File, slot: number) {
    if (uploading) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024) {
      setUploadError("Choose a JPG, PNG, WebP or GIF under 10 MB.");
      return;
    }
    setUploadError("");
    setUploading(uploadKey(slot));
    const form = new FormData(); form.set("image",file);
    try {
      const response = await fetch("/api/storyboard/upload", { method:"POST", body:form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Upload failed.");
      onChange(s => putImageInSlot(s, slot, body.src));
    } catch (error) { setUploadError(error instanceof Error ? error.message : "Upload failed."); }
    finally { setUploading(null); }
  }
  function uploadFromInput(event: React.ChangeEvent<HTMLInputElement>, slot: number) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadFile(file, slot);
  }
  function isFileDrag(event: React.DragEvent) {
    return Array.from(event.dataTransfer.types).includes("Files");
  }
  function fileDragOver(event: React.DragEvent, target: number) {
    if (!isFileDrag(event) || uploading) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    if (dropTarget !== target) setDropTarget(target);
  }
  function fileDragLeave(event: React.DragEvent, target: number) {
    if (dropTarget !== target) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX <= rect.left || event.clientX >= rect.right || event.clientY <= rect.top || event.clientY >= rect.bottom) setDropTarget(null);
  }
  function fileDrop(event: React.DragEvent, slot: number) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setDropTarget(null);
    if (event.dataTransfer.files.length !== 1) {
      setUploadError("Drop one image at a time.");
      return;
    }
    void uploadFile(event.dataTransfer.files[0], slot);
  }
  function moveImage(id: string, direction: -1 | 1) {
    const image = section.images.find(item => item.id === id);
    if (!image || image.slot + direction < 0 || image.slot + direction >= total) return;
    onChange(s => moveImageToSlot(s, id, image.slot + direction));
  }
  function dropImage(event: React.DragEvent, targetSlot: number) {
    const item = drag.current;
    if (item?.kind !== "image" || item.sectionId !== section.id) return;
    event.preventDefault(); event.stopPropagation(); drag.current = null;
    onChange(s => moveImageToSlot(s, item.id, targetSlot));
  }
  return <div className="sb-image-editor"><label>Layout <select aria-label="Image layout" value={section.layout} onChange={event => setLayout(event.target.value as typeof section.layout)}><option value="single">Single image</option><option value="2x2">2 rows × 2 images</option><option value="2x3">2 rows × 3 images</option><option value="3x3">3 rows × 3 images</option></select></label>
    <div className={`sb-image-cards storyboard-image-grid storyboard-layout-${section.layout}`}>
      {Array.from({length:total},(_,slot)=>{
        const image = section.images.find(item => item.slot === slot);
        return image ? <div key={`slot-${slot}`} data-slot={slot} className={`sb-image-card sb-file-dropzone ${dropTarget===slot?"is-file-over":""}`} onDragOver={event=>{if(isFileDrag(event))fileDragOver(event,slot);else if(drag.current?.kind==="image")event.preventDefault();}} onDragLeave={event=>fileDragLeave(event,slot)} onDrop={event=>{if(isFileDrag(event))fileDrop(event,slot);else dropImage(event,slot);}}>
          <div className="sb-image-controls"><button type="button" className="sb-grip" draggable onDragStart={event=>startDrag(event,{kind:"image",id:image.id,sectionId:section.id})} onDragEnd={()=>{drag.current=null;}} aria-label={`Drag image ${slot+1}`}>⋮⋮</button><span>Image {slot+1}</span><button type="button" aria-label={`Move image ${slot+1} backward`} disabled={slot===0} onClick={()=>moveImage(image.id,-1)}>←</button><button type="button" aria-label={`Move image ${slot+1} forward`} disabled={slot===total-1} onClick={()=>moveImage(image.id,1)}>→</button><button type="button" aria-label={`Remove image ${slot+1}`} onClick={()=>onChange(s=>{s.images=s.images.filter(i=>i.id!==image.id);})}>×</button></div>
          <div className="storyboard-image-wrap"><Image src={image.src} alt={image.description||`Image ${slot+1}`} fill unoptimized sizes="(max-width: 700px) 100vw, 50vw" /><span className="sb-drop-overlay" aria-hidden="true">{uploading===uploadKey(slot)?"Uploading…":"Drop image to replace"}</span></div>
          <label>Description <textarea aria-label={`Description for image ${slot+1}`} value={image.description} onChange={event=>onChange(s=>{const item=s.images.find(i=>i.id===image.id);if(item)item.description=event.target.value;})} /></label>
          <button type="button" className="sb-library-open" onClick={() => {setPickTarget(slot);setLibraryQuery("");setLibraryLimit(18);}}>Replace from image library</button>
          <label className="sb-upload">{uploading===uploadKey(slot)?"Uploading…":"Upload replacement"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={!!uploading} onChange={event=>uploadFromInput(event,slot)} /></label>
        </div> : <div key={`slot-${slot}`} data-slot={slot} role="group" aria-label={`Image slot ${slot+1}`} className={`sb-image-placeholder sb-file-dropzone ${dropTarget===slot?"is-file-over":""}`} onDragOver={event=>{if(isFileDrag(event))fileDragOver(event,slot);else if(drag.current?.kind==="image")event.preventDefault();}} onDragLeave={event=>fileDragLeave(event,slot)} onDrop={event=>{if(isFileDrag(event))fileDrop(event,slot);else dropImage(event,slot);}}><svg className="sb-drop-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 4v15m0 0-5-5m5 5 5-5M6 23v4h20v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg><p>Image {slot+1}</p><button type="button" className="sb-library-open" onClick={() => {setPickTarget(slot);setLibraryQuery("");setLibraryLimit(18);}}>Choose from image library</button><label className="sb-upload">{uploading===uploadKey(slot)?"Uploading…":"Upload image"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={!!uploading} onChange={event=>uploadFromInput(event,slot)} /></label></div>;
      })}
    </div>
    {uploadError && <p className="sb-upload-error" role="alert">{uploadError}</p>}
    {pickTarget !== null && <div className="sb-library-picker"><div className="sb-library-top"><strong>{section.images.some(image=>image.slot===pickTarget) ? `Replace image ${pickTarget+1}` : `Choose image for slot ${pickTarget+1}`}</strong><button type="button" onClick={() => setPickTarget(null)}>Close</button></div><div className="sb-library-filters"><select aria-label="Filter image library by chapter" value={libraryChapter} onChange={event => {setLibraryChapter(event.target.value);setLibraryLimit(18);}}><option value="">All chapters</option>{libraryChapters.map(chapter => <option key={chapter} value={chapter}>{chapter}</option>)}</select><input aria-label="Search image library" placeholder="Search filename or frame number…" value={libraryQuery} onChange={event => {setLibraryQuery(event.target.value);setLibraryLimit(18);}} /></div><p className="sb-muted">{matches.length} results · choose a thumbnail</p><div className="sb-library-results">{matches.slice(0,libraryLimit).map(src => <button type="button" key={src} title={decodeURIComponent(src)} onClick={() => pickImage(src)}><span><Image src={src} alt="" fill unoptimized sizes="120px" /></span><small>{imageLabel(src)}</small></button>)}</div>{matches.length > libraryLimit && <button type="button" className="sb-library-more" onClick={() => setLibraryLimit(value => value + 18)}>Show more images</button>}</div>}
    <p className="sb-muted">{section.images.length} of {total} slots filled. Drop an image file onto a slot, or drag an existing image between slots.</p>
  </div>;
}
