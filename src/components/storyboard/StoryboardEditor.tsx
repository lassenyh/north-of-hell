"use client";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import type { Editor } from "@tiptap/core";
import { ScreenplayEditor } from "@/components/screenplay/ScreenplayEditor";
import { ScreenplayToolbar } from "@/components/screenplay/ScreenplayToolbar";
import { MainSiteHeader } from "@/components/MainSiteHeader";
import { StoryboardDocumentView, SectionContent, cleanTextHtml } from "./StoryboardDocumentView";
import { ComicSectionEditor } from "./ComicSectionEditor";
import { VideoSectionEditor } from "./VideoSectionEditor";
import { StoryboardLibraryDialog } from "./StoryboardLibraryDialog";
import { StoryboardShareDialog } from "./StoryboardShareDialog";
import { StoryboardLibraryUpload } from "./StoryboardLibraryUpload";
import { libraryChapter as libraryChapterOf } from "@/lib/storyboard/library-chapter";
import { COMIC_RENDER_VERSION } from "@/lib/storyboard/comic-svg";
import { StoryboardTheme } from "./StoryboardTheme";
import { duplicateChapter, duplicateSection, insertNumberedSection, moveImageToSlot, moveSectionWithNumbering, newId, putImageInSlot, type Chapter, type Section, type StoryboardDocument, type StoryboardState } from "@/lib/storyboard/model";
import { saveDraftAction, publishDraftAction } from "@/app/admin/storyboard/actions";
import "./storyboard-editor.css";

type Drag = { kind: "chapter"; id: string } | { kind: "section"; id: string } | { kind: "image"; id: string; sectionId: string };
type LayerDropPreview = { kind: "chapter"; targetId: string; after: boolean } | { kind: "section"; chapterId: string; targetId?: string; after: boolean };
const capacity = { single: 1, "1x2": 2, "2x2": 4, "2x3": 6, "3x3": 9 } as const;
const sectionNames = { text: "Regular text", screenplay: "Screenplay", images: "Images", comic: "Comic scroll", video: "Video" } as const;
const libraryNameSort = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const libraryFilename = (src: string) => decodeURIComponent(src.split("/").at(-1) || "Frame").replace(/^[0-9]+-[0-9a-f-]{36}-/, "");
const AUTO_SAVE_IDLE_MS = 2 * 60 * 1000;
const SAVE_TIMEOUT_MS = 30 * 1000;
const SAVE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const SAVE_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", dateStyle: "full", timeStyle: "short" });

function sectionExcerpt(section: Section) {
  const source = section.kind === "text" ? section.html : section.kind === "screenplay" ? section.blocks.find(block => block.text.trim())?.text || "" : "";
  return source.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\s+/g, " ").trim();
}

function comicSummary(section: Extract<Section, { kind: "comic" }>) {
  const textCount = section.bubbles.filter(bubble => bubble.shape === "rectangle").length;
  const bubbleCount = section.bubbles.length - textCount;
  return `${bubbleCount} ${bubbleCount === 1 ? "bubble" : "bubbles"}${textCount ? ` · ${textCount} ${textCount === 1 ? "text panel" : "text panels"}` : ""} · ${section.sounds.length} ${section.sounds.length === 1 ? "sound effect" : "sound effects"}`;
}

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

export default function StoryboardEditor(props: { initial: StoryboardState; library: string[]; libraryChapters: string[]; hiddenLibrary: string[]; demoPublish?: "loading" | "success" }) {
  return <StoryboardTheme><StoryboardEditorContent {...props} /></StoryboardTheme>;
}

function StoryboardEditorContent({ initial, library: initialLibrary, libraryChapters: initialLibraryChapters, hiddenLibrary: initialHiddenLibrary, demoPublish }: { initial: StoryboardState; library: string[]; libraryChapters: string[]; hiddenLibrary: string[]; demoPublish?: "loading" | "success" }) {
  const [tab, setTab] = useState<"preview" | "editor">("editor");
  const [document, setDocument] = useState(initial.draft);
  const [published, setPublished] = useState(initial.published);
  const [version, setVersion] = useState(initial.draftVersion);
  const [publishedVersion, setPublishedVersion] = useState(initial.publishedVersion);
  const [lastSavedAt, setLastSavedAt] = useState(initial.savedAt);
  const [savedJson, setSavedJson] = useState(JSON.stringify(initial.draft));
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [publishSuccess, setPublishSuccess] = useState(demoPublish === "success");
  const [savePending, setSavePending] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const editorScrollY = useRef(0);
  const layerScrollY = useRef(0);
  const previewTargetId = useRef<string | null>(null);
  const pendingViewSwitch = useRef<"preview" | "editor" | null>(null);
  const saveRequest = useRef<Promise<Awaited<ReturnType<typeof saveDraftAction>>> | null>(null);
  const saveRef = useRef<((automatic?: boolean) => Promise<void>) | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);
  const [textEditor, setTextEditor] = useState<Editor | null>(null);
  const [manusEditor, setManusEditor] = useState<Editor | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [library, setLibrary] = useState(initialLibrary);
  const [hiddenLibrary, setHiddenLibrary] = useState(initialHiddenLibrary);
  const [showHiddenLibrary, setShowHiddenLibrary] = useState(false);
  const [libraryChapters, setLibraryChapters] = useState(initialLibraryChapters);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [deletingLibraryImage, setDeletingLibraryImage] = useState<string | null>(null);
  const [libraryFilter, setLibraryFilter] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryView, setLibraryView] = useState<"grid" | "list">("grid");
  const [libraryLimit, setLibraryLimit] = useState(48);
  const [draggingLayer, setDraggingLayer] = useState<Drag | null>(null);
  const [layerDropPreview, setLayerDropPreview] = useState<LayerDropPreview | null>(null);
  const layerDropPreviewRef = useRef<LayerDropPreview | null>(null);
  const [canvasDropPreview, setCanvasDropPreview] = useState<LayerDropPreview | null>(null);
  const canvasDropPreviewRef = useRef<LayerDropPreview | null>(null);
  const addLibraryChapter = (chapter: string) => setLibraryChapters(current => current.includes(chapter) ? current : [...current, chapter].sort());
  const addLibraryImage = (src: string) => { setLibrary(current => current.includes(src) ? current : [...current, src]); addLibraryChapter(libraryChapterOf(src)); };
  const visibleLibrary = [...library, ...(showHiddenLibrary ? hiddenLibrary : [])].filter(src => (!libraryFilter || libraryChapterOf(src) === libraryFilter) && src.toLowerCase().includes(librarySearch.toLowerCase()));
  const orderedLibrary = libraryView === "list" ? [...visibleLibrary].sort((a, b) => libraryNameSort.compare(libraryChapterOf(a), libraryChapterOf(b)) || libraryNameSort.compare(libraryFilename(a), libraryFilename(b))) : visibleLibrary;
  const drag = useRef<Drag | null>(null);
  const dirty = JSON.stringify(document) !== savedJson;
  const outdatedComic = published?.chapters.some(chapter => chapter.sections.some(section => section.kind === "comic" && !!section.src && section.renderVersion !== COMIC_RENDER_VERSION)) ?? false;
  const selectedSection = document.chapters.flatMap(ch => ch.sections).find(sec => sec.id === selectedId);
  const screenplayBlocks = document.chapters.flatMap(ch => ch.sections.flatMap(sec => sec.kind === "screenplay" ? sec.blocks : []));

  function imageIsUsed(src: string) {
    return [document, published].some(doc => doc?.chapters.some(chapter => chapter.sections.some(section => section.kind === "images"
      ? section.images.some(image => image.src === src)
      : section.kind === "comic" && section.src === src)));
  }

  async function deleteLibraryImage(src: string) {
    const bundled = src.startsWith("/storyboard/");
    if (!bundled && imageIsUsed(src)) { setLibraryError("This image is used in the storyboard. Remove or replace it there first."); return; }
    if (!window.confirm(bundled ? "Hide this built-in frame from the library? Existing storyboard sections will keep it, and you can restore it here." : `Delete this uploaded frame from the image library?\n\n${decodeURIComponent(src.split("/").at(-1) || src)}`)) return;
    setDeletingLibraryImage(src); setLibraryError("");
    try {
      const response = await fetch("/api/storyboard/library", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ src }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not delete image.");
      setLibrary(current => current.filter(item => item !== src));
      if (result.hidden) setHiddenLibrary(current => current.includes(src) ? current : [...current, src]);
    } catch (cause) { setLibraryError(cause instanceof Error ? cause.message : "Could not delete image."); }
    finally { setDeletingLibraryImage(null); }
  }

  async function restoreLibraryImage(src: string) {
    setDeletingLibraryImage(src); setLibraryError("");
    try {
      const response = await fetch("/api/storyboard/library", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ src }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not restore image.");
      setHiddenLibrary(current => current.filter(item => item !== src));
      setLibrary(current => current.includes(src) ? current : [...current, src]);
    } catch (cause) { setLibraryError(cause instanceof Error ? cause.message : "Could not restore image."); }
    finally { setDeletingLibraryImage(null); }
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!publishSuccess) return;
    const timer = window.setTimeout(() => setPublishSuccess(false), 2000);
    return () => window.clearTimeout(timer);
  }, [publishSuccess]);
  useEffect(() => {
    if (!dirty || busy || savePending) return;
    const timer = window.setTimeout(() => { void saveRef.current?.(true); }, AUTO_SAVE_IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, busy, savePending, document]);
  useEffect(() => {
    if (!selectedId) return;
    const layer = globalThis.document.getElementById(`layer-${selectedId}`);
    layer?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    globalThis.document.getElementById(`edit-${selectedId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId, expandedChapters]);
  const switchView = useCallback((next: "preview" | "editor") => {
    if (next === tab) return;
    if (next === "preview") {
      editorScrollY.current = window.scrollY;
      layerScrollY.current = globalThis.document.querySelector<HTMLElement>(".sb-layers")?.scrollTop ?? 0;
      previewTargetId.current = selectedId;
    }
    pendingViewSwitch.current = next;
    setTab(next);
  }, [selectedId, tab]);
  useLayoutEffect(() => {
    if (pendingViewSwitch.current !== tab) return;
    pendingViewSwitch.current = null;
    if (tab === "editor") {
      const layers = globalThis.document.querySelector<HTMLElement>(".sb-layers");
      if (layers) layers.scrollTop = layerScrollY.current;
      window.scrollTo({ top: editorScrollY.current, behavior: "instant" });
      return;
    }
    const id = previewTargetId.current;
    const section = id && globalThis.document.getElementById(`section-${id}`);
    const chapterId = document.chapters.find(chapter => chapter.id === id || chapter.sections.some(item => item.id === id))?.id;
    const target = section || (chapterId && globalThis.document.getElementById(`chapter-${chapterId}`));
    if (!target) { window.scrollTo({ top: 0, behavior: "instant" }); return; }
    const topbar = globalThis.document.querySelector<HTMLElement>(".sb-topbar");
    const jump = globalThis.document.querySelector<HTMLElement>(".sb-finished .storyboard-jump");
    const offset = (topbar?.getBoundingClientRect().bottom ?? 0) + (jump?.getBoundingClientRect().height ?? 0) + 16;
    window.scrollTo({ top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - offset), behavior: "instant" });
  }, [tab, document.chapters]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "p" || event.repeat || event.isComposing || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"]')) return;
      if (globalThis.document.querySelector('dialog[open], [role="dialog"]')) return;
      event.preventDefault();
      switchView(tab === "editor" ? "preview" : "editor");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [switchView, tab]);
  const status = dirty ? "Unsaved changes" : version === 0 ? "No saved draft" : publishedVersion === version ? outdatedComic ? "Updated comic style available" : "Published version" : "Saved draft";
  const savedDate = lastSavedAt && !Number.isNaN(Date.parse(lastSavedAt)) ? new Date(lastSavedAt) : null;
  const publishOverlayState = busy === "publish" || demoPublish === "loading" ? "loading" : publishSuccess ? "success" : null;

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
  function addSection(chapterId: string, kind: Section["kind"], afterSectionId?: string) {
    const id = newId();
    change(doc => {
      const ch = doc.chapters.find(c => c.id === chapterId);
      if (!ch) return;
      const section: Section = kind === "text" ? { id, kind, title: "New text section", html: "<p></p>", align: "left", size: 18 }
        : kind === "screenplay" ? { id, kind, title: "New screenplay section", blocks: [{ type: "scene_heading", text: "" }] }
        : kind === "images" ? { id, kind, title: "New image section", layout: "single", images: [] }
        : kind === "video" ? { id, kind, title: "New video section", src: "" }
        : { id, kind: "comic", title: "New comic section", src: "", description: "", aspect: "16:9", imageWidth: 800, imageHeight: 450, topSpace: 240, bottomSpace: 240, background: "#000000", bubbles: [], sounds: [] };
      insertNumberedSection(doc, chapterId, section, afterSectionId);
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
    change(doc => { moveSectionWithNumbering(doc, id, chapterId, targetId, after); });
    setExpandedChapters(current => current.includes(chapterId) ? current : [...current, chapterId]);
  }
  function setLayerPreview(preview: LayerDropPreview | null) {
    const current = layerDropPreviewRef.current;
    if (!current && !preview) return;
    if (current?.kind === "chapter" && preview?.kind === "chapter" && current.targetId === preview.targetId && current.after === preview.after) return;
    if (current?.kind === "section" && preview?.kind === "section" && current.chapterId === preview.chapterId && current.targetId === preview.targetId && current.after === preview.after) return;
    layerDropPreviewRef.current = preview;
    setLayerDropPreview(preview);
  }
  function setCanvasPreview(preview: LayerDropPreview | null) {
    const current = canvasDropPreviewRef.current;
    if (!current && !preview) return;
    if (current?.kind === "chapter" && preview?.kind === "chapter" && current.targetId === preview.targetId && current.after === preview.after) return;
    if (current?.kind === "section" && preview?.kind === "section" && current.chapterId === preview.chapterId && current.targetId === preview.targetId && current.after === preview.after) return;
    canvasDropPreviewRef.current = preview;
    setCanvasDropPreview(preview);
  }
  function clearDrag() {
    drag.current = null;
    setDraggingLayer(null);
    setLayerPreview(null);
    setCanvasPreview(null);
  }
  function startDrag(event: React.DragEvent, item: Drag) {
    drag.current = item;
    setDraggingLayer(item.kind === "image" ? null : item);
    setLayerPreview(null);
    setCanvasPreview(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.id);
  }
  function allowDrop(event: React.DragEvent) { if (drag.current) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }
  function previewLayerDrop(event: React.DragEvent, chapterId: string, targetId?: string) {
    const item = drag.current;
    if (!item || item.kind === "image") return;
    setCanvasPreview(null);
    allowDrop(event);
    if (item.kind === "chapter") {
      if (item.id === chapterId) { setLayerPreview(null); return; }
      const header = event.currentTarget.querySelector<HTMLElement>(".sb-chapter-row");
      const midpoint = header ? header.getBoundingClientRect().top + header.getBoundingClientRect().height / 2 : event.currentTarget.getBoundingClientRect().top;
      setLayerPreview({ kind: "chapter", targetId: chapterId, after: event.clientY > midpoint });
      return;
    }
    if (targetId === item.id) { setLayerPreview(null); return; }
    if (targetId) {
      const rect = event.currentTarget.getBoundingClientRect();
      setLayerPreview({ kind: "section", chapterId, targetId, after: event.clientY > rect.top + rect.height / 2 });
    } else setLayerPreview({ kind: "section", chapterId, after: false });
  }
  function previewCanvasChapterDrop(event: React.DragEvent, chapter: Chapter) {
    const item = drag.current;
    if (!item || item.kind === "image") return;
    setLayerPreview(null);
    allowDrop(event);
    if (item.kind === "chapter") {
      if (item.id === chapter.id) { setCanvasPreview(null); return; }
      const heading = event.currentTarget.querySelector<HTMLElement>(".sb-edit-heading");
      const midpoint = heading ? heading.getBoundingClientRect().top + heading.getBoundingClientRect().height / 2 : event.currentTarget.getBoundingClientRect().top;
      setCanvasPreview({ kind: "chapter", targetId: chapter.id, after: event.clientY > midpoint });
      return;
    }
    const target = event.target;
    const overHeading = target instanceof Element && !!target.closest(".sb-edit-heading,.sb-title-input,.sb-edit-chapter > h2");
    setCanvasPreview(overHeading && chapter.sections.length
      ? { kind: "section", chapterId: chapter.id, targetId: chapter.sections[0].id, after: false }
      : { kind: "section", chapterId: chapter.id, after: false });
  }
  function previewCanvasSectionDrop(event: React.DragEvent, chapterId: string, sectionId: string) {
    if (drag.current?.kind !== "section") return;
    event.stopPropagation();
    setLayerPreview(null);
    allowDrop(event);
    if (drag.current.id === sectionId) { setCanvasPreview(null); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    setCanvasPreview({ kind: "section", chapterId, targetId: sectionId, after: event.clientY > rect.top + rect.height / 2 });
  }
  function dropOnCanvas(event: React.DragEvent) {
    const item = drag.current;
    if (!item || item.kind === "image") return;
    event.preventDefault(); event.stopPropagation();
    const preview = canvasDropPreviewRef.current;
    clearDrag();
    if (item.kind === "chapter" && preview?.kind === "chapter") moveChapter(item.id, preview.targetId, preview.after);
    if (item.kind === "section" && preview?.kind === "section") moveSection(item.id, preview.chapterId, preview.targetId, preview.after);
  }
  function dropOnLayers(event: React.DragEvent) {
    event.preventDefault(); event.stopPropagation();
    const item = drag.current;
    const preview = layerDropPreviewRef.current;
    clearDrag();
    if (item?.kind === "chapter" && preview?.kind === "chapter") moveChapter(item.id, preview.targetId, preview.after);
    if (item?.kind === "section" && preview?.kind === "section") moveSection(item.id, preview.chapterId, preview.targetId, preview.after);
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
  async function save(automatic = false) {
    if (busy || saveRequest.current || !dirty && version > 0) return;
    const snapshot = structuredClone(document); const serialized = JSON.stringify(snapshot);
    setBusy("save"); setError(""); setFlash("");
    setSavePending(true);
    const request = Promise.resolve().then(() => saveDraftAction(snapshot, version));
    saveRequest.current = request;
    let timedOut = false;
    let timeout: number | undefined;
    const finish = (result: Awaited<typeof request>) => {
      if (result.ok) {
        setVersion(result.version);
        setLastSavedAt(result.savedAt);
        setSavedJson(serialized);
        setError("");
        setFlash(automatic ? "Draft autosaved" : "Draft saved");
      } else {
        setError(result.error);
      }
    };
    try {
      const result = await Promise.race([
        request,
        new Promise<null>(resolve => { timeout = window.setTimeout(() => resolve(null), SAVE_TIMEOUT_MS); }),
      ]);
      if (result === null) {
        timedOut = true;
        setBusy(null);
        setError("Saving is taking longer than expected. Keep this tab open; the save is still pending.");
        void request.then(finish).catch(cause => setError(cause instanceof Error ? cause.message : "Saving failed.")).finally(() => {
          if (saveRequest.current === request) saveRequest.current = null;
          setSavePending(false);
        });
        return;
      }
      finish(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Saving failed.");
    } finally {
      if (timeout) window.clearTimeout(timeout);
      if (!timedOut) {
        if (saveRequest.current === request) saveRequest.current = null;
        setSavePending(false);
        setBusy(null);
      }
    }
  }
  saveRef.current = save;
  async function publish() {
    if (busy || savePending || saveRequest.current || dirty || version === 0) return;
    setBusy("publish"); setPublishSuccess(false); setError(""); setFlash("");
    try {
      const result = await publishDraftAction(version);
      if (result.ok) { setPublished(result.published); setPublishedVersion(result.version); setFlash("Published version updated"); setPublishSuccess(true); }
      else setError(result.error);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Publishing failed.");
    } finally {
      setBusy(null);
    }
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
  const sectionAddButtons = (chapter: Chapter, afterSectionId?: string) => (
    <div className={`sb-layer-add ${afterSectionId ? "sb-layer-add--after" : "sb-layer-add--chapter"}`} aria-label={afterSectionId ? "Add section below selected layer" : "Add section to selected chapter"}>
      <span>{afterSectionId ? "Add below this layer" : "Add to end of chapter"}</span>
      {([ ["text", "Text"], ["screenplay", "Screenplay"], ["images", "Images"], ["comic", "Comic scroll"], ["video", "Video"] ] as const).map(([kind, label]) => <button key={kind} type="button" onClick={event => { event.stopPropagation(); addSection(chapter.id, kind, afterSectionId); }}>+ {label}</button>)}
    </div>
  );
  const draggedSection = draggingLayer?.kind === "section" ? document.chapters.flatMap(chapter => chapter.sections).find(section => section.id === draggingLayer.id) : null;
  const draggedChapter = draggingLayer?.kind === "chapter" ? document.chapters.find(chapter => chapter.id === draggingLayer.id) : null;
  const layerPlaceholder = () => <div className="sb-layer-drop-preview" aria-hidden="true" onDragOver={event => { event.stopPropagation(); allowDrop(event); }}><span>{draggedSection ? sectionNames[draggedSection.kind] : "Chapter"}</span><strong>{draggedSection?.title || draggedChapter?.title}</strong></div>;
  const canvasPlaceholder = (kind: "chapter" | "section") => <div className={`sb-canvas-drop-preview sb-canvas-drop-preview--${kind}`} aria-hidden="true" onDragOver={event => { event.stopPropagation(); allowDrop(event); }}><span>{kind === "chapter" ? "Move chapter here" : "Move section here"}</span><strong>{draggedSection?.title || draggedChapter?.title}</strong></div>;
  const sectionRow = (section: Section, chapter: Chapter) => (
    <div className={`sb-layer-section${draggingLayer?.kind === "section" && draggingLayer.id === section.id ? " is-dragging" : ""}`}><div id={`layer-${section.id}`} className={`sb-layer-row sb-section-row ${selectedId === section.id ? "is-selected" : ""}`}
      onDragOver={event => { if (drag.current?.kind === "section") { event.stopPropagation(); previewLayerDrop(event, chapter.id, section.id); } }}>
      <button type="button" className="sb-grip" draggable onDragStart={event => startDrag(event, { kind: "section", id: section.id })} aria-label={`Drag ${section.title}`}>⋮⋮</button>
      <button type="button" className="sb-layer-label" title={section.title} onClick={() => select(section.id)}><span>{sectionNames[section.kind]}</span>{section.title}</button>
      <button type="button" title="Move up" aria-label={`Move ${section.title} up`} onClick={() => moveByButton(section.id, -1)}>↑</button>
      <button type="button" title="Move down" aria-label={`Move ${section.title} down`} onClick={() => moveByButton(section.id, 1)}>↓</button>
      <button type="button" title="Duplicate" aria-label={`Duplicate ${section.title}`} onClick={() => duplicate(section.id)}>⧉</button>
      <button type="button" title="Delete" aria-label={`Delete ${section.title}`} onClick={() => remove(section.id)}>×</button>
    </div>{selectedId === section.id && sectionAddButtons(chapter, section.id)}</div>
  );

  const textToolbar = <div className="sb-formatbar sb-text-toolbar" role="toolbar" aria-label="Text formatting">
    <span>Text</span><select aria-label="Style" disabled={!textEditor} value={textEditor?.isActive("heading", { level: 2 }) ? "h2" : textEditor?.isActive("heading", { level: 3 }) ? "h3" : "p"} onChange={event => { const ch = textEditor?.chain().focus(); if (event.target.value === "p") ch?.setParagraph().run(); if (event.target.value === "h2") ch?.toggleHeading({ level: 2 }).run(); if (event.target.value === "h3") ch?.toggleHeading({ level: 3 }).run(); }}><option value="p">Regular text</option><option value="h2">Heading</option><option value="h3">Subheading</option></select>
    <select aria-label="Font size" value={selectedSection?.kind === "text" ? selectedSection.size : 16} onChange={event => selectedSection && updateSection(selectedSection.id, s => { if (s.kind === "text") s.size = Number(event.target.value); })}>{[12,14,16,18,20,24,30,36].map(size => <option key={size} value={size}>{size} pt</option>)}</select>
    <span className="sb-divider" />{([ ["bold","Bold","B"], ["italic","Italic","I"], ["underline","Underline","U"], ["bulletList","Bullet list","•"], ["orderedList","Numbered list","1."] ] as const).map(([name,label,icon]) => <button type="button" key={name} title={label} aria-label={label} disabled={!textEditor} onMouseDown={event => event.preventDefault()} onClick={() => command(name)}>{icon}</button>)}
    <span className="sb-divider" />{([ ["left","Align left","≡"], ["center","Align center","☰"], ["right","Align right","≡"] ] as const).map(([align,label,icon]) => <button type="button" key={align} title={label} aria-label={label} aria-pressed={selectedSection?.kind === "text" && selectedSection.align === align} onClick={() => selectedSection && updateSection(selectedSection.id, s => { if (s.kind === "text") s.align = align; })}>{icon}</button>)}
  </div>;

  return <div className="sb-app" onDragEndCapture={clearDrag}>
    <MainSiteHeader />
    {publishOverlayState && <div className={`sb-publish-overlay ${publishOverlayState === "success" ? "is-success" : ""}`}>
      <div className="sb-publish-content">
        <div className="sb-publish-logo">
          <Image src="/Login-assets/NOH_TITLE_C72B1F.png" alt="North of Hell" width={7373} height={1562} priority />
          {publishOverlayState === "loading" && <Image className="sb-publish-logo-swipe" src="/Login-assets/NOH_TITLE_C72B1F.png" alt="" aria-hidden="true" width={7373} height={1562} />}
        </div>
        {publishOverlayState === "loading" ? <div className="sb-publish-progress" aria-hidden="true"><span /></div> : <span className="sb-publish-success-mark" aria-hidden="true">✓</span>}
        <p role="status" aria-live="polite">{publishOverlayState === "loading" ? <>Publishing storyboard<span aria-hidden="true">…</span></> : "Storyboard published"}</p>
        {publishOverlayState === "success" && <span className="sb-publish-success-detail">The latest version is live.</span>}
        {demoPublish && busy !== "publish" ? <Link href="/storyboard-studio" className="sb-publish-dismiss">Close demo</Link> : publishOverlayState === "success" && <button type="button" className="sb-publish-dismiss" onClick={() => setPublishSuccess(false)}>Continue editing</button>}
      </div>
    </div>}
    <header className="sb-topbar">
      <div><h1>Storyboard studio</h1></div>
      <nav className="sb-tabs" aria-label="Storyboard view"><button type="button" aria-current={tab === "preview" ? "page" : undefined} onClick={() => switchView("preview")} title="Preview draft (P)">Preview <span className="sb-tab-shortcut" aria-hidden="true">P</span></button><button type="button" aria-current={tab === "editor" ? "page" : undefined} onClick={() => switchView("editor")} title="Return to editor (P)">Editor</button></nav>
      <div className="sb-save-actions"><span className={`sb-status ${dirty ? "dirty" : ""}`} role="status" title={dirty ? "Automatically saves after 2 minutes without editing" : undefined}>{status}{version > 0 && savedDate && <> · <time dateTime={lastSavedAt!} title={`Last saved ${SAVE_DATE_FORMATTER.format(savedDate)} (Oslo time)`}>{dirty ? "last saved " : ""}{SAVE_TIME_FORMATTER.format(savedDate)}</time></>}</span><button type="button" onClick={() => void save()} disabled={!!busy || savePending || !dirty && version > 0}>{busy === "save" ? "Saving…" : savePending ? "Save pending…" : "Save draft"}</button><button type="button" className="primary" onClick={publish} disabled={!!busy || savePending || !!saveRequest.current || dirty || version === 0 || publishedVersion === version && !outdatedComic}>{busy === "publish" ? "Publishing…" : "Publish"}</button><button type="button" onClick={() => setShareOpen(true)} disabled={!published} title={published ? "Share the latest published storyboard" : "Publish a storyboard before sharing"}>Share</button></div>
    </header>
    {shareOpen && <StoryboardShareDialog onClose={() => setShareOpen(false)} />}
    {(error || flash) && <div className={error ? "sb-message error" : "sb-message"} role={error ? "alert" : "status"}>{error || flash}</div>}
    {tab === "preview" ? <div className="sb-finished"><div className="sb-finished-note"><span>Draft preview{dirty ? " · Includes unsaved changes" : ""}</span><Link href="/storyboard" target="_blank">Open published page ↗</Link></div><StoryboardDocumentView document={document} preview /></div> : <>
      <div className="sb-workspace">
        <aside className="sb-layers" onDragOver={event => { allowDrop(event); setCanvasPreview(null); if (event.target instanceof Element && !event.target.closest(".sb-layer-chapter,.sb-layer-drop-preview")) setLayerPreview(null); }} onDragLeave={event => { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setLayerPreview(null); }} onDrop={dropOnLayers}><div className="sb-panel-heading"><h2>Layers</h2><button type="button" onClick={addChapter}>+ Chapter</button></div><button type="button" className="sb-open-library" onClick={() => setLibraryOpen(true)}>Image library · Upload frames</button>
          {document.chapters.length === 0 && <p className="sb-muted">Start with a chapter.</p>}
          {document.chapters.map((chapter, index) => <Fragment key={chapter.id}>
            {layerDropPreview?.kind === "chapter" && layerDropPreview.targetId === chapter.id && !layerDropPreview.after && layerPlaceholder()}
            <div id={`layer-${chapter.id}`} className={`sb-layer-chapter${draggingLayer?.kind === "chapter" && draggingLayer.id === chapter.id ? " is-dragging" : ""}`} onDragOver={event => previewLayerDrop(event, chapter.id)}>
            <div className={`sb-layer-row sb-chapter-row ${selectedId === chapter.id ? "is-selected" : ""}`}>
              <button type="button" className="sb-grip" draggable onDragStart={event => startDrag(event, { kind: "chapter", id: chapter.id })} aria-label={`Drag chapter ${chapter.title}`}>⋮⋮</button>
              <button type="button" className="sb-expand" aria-label={`${expandedChapters.includes(chapter.id) ? "Hide" : "Show"} sections in ${chapter.title}`} aria-expanded={expandedChapters.includes(chapter.id)} onClick={() => setExpandedChapters(current => current.includes(chapter.id) ? current.filter(id => id !== chapter.id) : [...current, chapter.id])}>{expandedChapters.includes(chapter.id) ? "▾" : "▸"}</button>
              <button type="button" className="sb-layer-label" title={chapter.title} onClick={() => select(chapter.id)}><span>CHAPTER {String(index+1).padStart(2,"0")}</span>{chapter.title}</button>
              <button type="button" title="Move up" aria-label={`Move chapter ${chapter.title} up`} onClick={() => moveByButton(chapter.id,-1)}>↑</button><button type="button" title="Move down" aria-label={`Move chapter ${chapter.title} down`} onClick={() => moveByButton(chapter.id,1)}>↓</button><button type="button" title="Duplicate" aria-label={`Duplicate chapter ${chapter.title}`} onClick={() => duplicate(chapter.id)}>⧉</button><button type="button" title="Delete" aria-label={`Delete chapter ${chapter.title}`} onClick={() => remove(chapter.id)}>×</button>
            </div>{expandedChapters.includes(chapter.id) && chapter.sections.map(section => <Fragment key={section.id}>
              {layerDropPreview?.kind === "section" && layerDropPreview.chapterId === chapter.id && layerDropPreview.targetId === section.id && !layerDropPreview.after && layerPlaceholder()}
              {sectionRow(section,chapter)}
              {layerDropPreview?.kind === "section" && layerDropPreview.chapterId === chapter.id && layerDropPreview.targetId === section.id && layerDropPreview.after && layerPlaceholder()}
            </Fragment>)}
            {layerDropPreview?.kind === "section" && layerDropPreview.chapterId === chapter.id && !layerDropPreview.targetId && layerPlaceholder()}
            {selectedId === chapter.id && sectionAddButtons(chapter)}
            </div>
            {layerDropPreview?.kind === "chapter" && layerDropPreview.targetId === chapter.id && layerDropPreview.after && layerPlaceholder()}
          </Fragment>)}
        </aside>
        <main className="sb-canvas" onDragOver={event => { setLayerPreview(null); if (drag.current?.kind !== "image" && event.target instanceof Element && !event.target.closest(".sb-edit-chapter,.sb-canvas-drop-preview")) setCanvasPreview(null); }} onDragLeave={event => { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setCanvasPreview(null); }} onDrop={dropOnCanvas}><div className="sb-canvas-top"><label>Document title<input aria-label="Document title" value={document.title} onChange={event => change(doc => { doc.title = event.target.value; })} /></label><span>{document.chapters.length} chapters</span></div>
          {document.chapters.map((chapter, index) => <Fragment key={chapter.id}>
          {canvasDropPreview?.kind === "chapter" && canvasDropPreview.targetId === chapter.id && !canvasDropPreview.after && canvasPlaceholder("chapter")}
          <article id={`edit-${chapter.id}`} className={`sb-edit-chapter ${selectedId === chapter.id ? "is-selected" : ""}${draggingLayer?.kind === "chapter" && draggingLayer.id === chapter.id ? " is-dragging" : ""}`} onDragOver={event => previewCanvasChapterDrop(event, chapter)} onClick={() => select(chapter.id)}>
            <div className="sb-edit-heading"><button type="button" className="sb-grip" draggable onDragStart={event => startDrag(event,{kind:"chapter",id:chapter.id})} aria-label={`Drag chapter ${chapter.title}`}>⋮⋮</button><span>CHAPTER {String(index+1).padStart(2,"0")}</span><button type="button" onClick={() => duplicate(chapter.id)}>Duplicate</button><button type="button" onClick={() => remove(chapter.id)}>Delete</button></div>
            {selectedId === chapter.id ? <input className="sb-title-input" aria-label="Chapter title" value={chapter.title} onChange={event => updateChapter(chapter.id,c => { c.title = event.target.value; })} onClick={event => event.stopPropagation()} /> : <h2>{chapter.title}</h2>}
            {expandedChapters.includes(chapter.id) ? chapter.sections.map(section => <Fragment key={section.id}>
              {canvasDropPreview?.kind === "section" && canvasDropPreview.chapterId === chapter.id && canvasDropPreview.targetId === section.id && !canvasDropPreview.after && canvasPlaceholder("section")}
              <section id={`edit-${section.id}`} className={`sb-edit-section sb-edit-section--${section.kind} ${selectedId === section.id ? "is-selected" : ""}${draggingLayer?.kind === "section" && draggingLayer.id === section.id ? " is-dragging" : ""}`} onDragOver={event => previewCanvasSectionDrop(event,chapter.id,section.id)} onClick={event => { event.stopPropagation(); if (selectedId !== section.id) select(section.id); }}>
              <div className="sb-edit-section-head"><button type="button" className="sb-grip" draggable onDragStart={event => startDrag(event,{kind:"section",id:section.id})} aria-label={`Drag ${section.title}`}>⋮⋮</button>{selectedId !== section.id ? <div className="sb-section-compact-copy"><span>{sectionNames[section.kind]}</span><h3>{section.title}</h3>{section.kind === "comic" && <p className="sb-comic-summary">{comicSummary(section)}</p>}{section.kind === "video" && <p className="sb-comic-summary">16:9 video</p>}{section.kind === "images" && <p className="sb-image-summary">{section.images.length} of {capacity[section.layout]} images</p>}{(section.kind === "text" || section.kind === "screenplay") && sectionExcerpt(section) && <p className="sb-section-excerpt">{sectionExcerpt(section)}</p>}</div> : <span>{sectionNames[section.kind]}</span>}{selectedId === section.id && section.kind === "comic" && <input className="sb-section-title-input" aria-label="Section title" value={section.title} onChange={event => updateSection(section.id,s => { s.title = event.target.value; })} />}{selectedId !== section.id && (section.kind === "comic" || section.kind === "video") && <SectionContent section={section} />}{selectedId !== section.id && section.kind === "images" && <ImageSectionPreview section={section} />}<button type="button" onClick={() => duplicate(section.id)}>Duplicate</button><button type="button" onClick={() => remove(section.id)}>Delete</button></div>
              {selectedId === section.id && section.kind !== "comic" && <input className="sb-section-title-input" aria-label="Section title" value={section.title} onChange={event => updateSection(section.id,s => { s.title = event.target.value; })} />}
              {selectedId === section.id && section.kind === "text" && textToolbar}
              {selectedId === section.id && section.kind === "screenplay" && <div className="sb-formatbar sb-screenplay-toolbar" role="toolbar" aria-label="Screenplay toolbar"><ScreenplayToolbar editor={manusEditor} /></div>}
              {selectedId !== section.id ? null : section.kind === "text" ? <div className="storyboard-prose" style={{textAlign:section.align,fontSize:`${section.size}px`}}><RichTextEditor key={section.id} html={section.html} onChange={html => { if (html !== section.html) updateSection(section.id,s => { if (s.kind === "text") s.html = html; }); }} onFocus={setTextEditor} /></div> : section.kind === "screenplay" ? <div className="sb-script-editor"><ScreenplayEditor key={section.id} initialContent={JSON.stringify(section.blocks)} smartTypeBlocks={screenplayBlocks} onEditorChange={setManusEditor} onChange={raw => { if (raw !== JSON.stringify(section.blocks)) updateSection(section.id,s => { if (s.kind === "screenplay") s.blocks = JSON.parse(raw); }); }} minRows={7} /></div> : section.kind === "images" ? <ImageSectionEditor section={section} library={library} libraryChapters={libraryChapters} defaultChapter={section.images[0]?.src ? libraryChapterOf(section.images[0].src) : chapter.title} onUploaded={addLibraryImage} onChapterCreated={addLibraryChapter} onChange={fn => updateSection(section.id,s => { if (s.kind === "images") fn(s); })} uploading={uploading} setUploading={setUploading} startDrag={startDrag} drag={drag} /> : section.kind === "video" ? <VideoSectionEditor section={section} onChange={src => updateSection(section.id,s => { if (s.kind === "video") s.src = src; })} /> : <ComicSectionEditor section={section} library={library} libraryChapters={libraryChapters} defaultChapter={section.src ? libraryChapterOf(section.src) : chapter.title} onUploaded={addLibraryImage} onChapterCreated={addLibraryChapter} onChange={fn => updateSection(section.id,s => { if (s.kind === "comic") fn(s); })} />}
              </section>
              {canvasDropPreview?.kind === "section" && canvasDropPreview.chapterId === chapter.id && canvasDropPreview.targetId === section.id && canvasDropPreview.after && canvasPlaceholder("section")}
            </Fragment>) : <button type="button" className="sb-show-sections" onClick={event => {event.stopPropagation();setExpandedChapters(current => [...current,chapter.id]);}}>{chapter.sections.length} sections · Show chapter</button>}
            {canvasDropPreview?.kind === "section" && canvasDropPreview.chapterId === chapter.id && !canvasDropPreview.targetId && canvasPlaceholder("section")}
            <div className="sb-canvas-add"><button type="button" onClick={event => {event.stopPropagation();addSection(chapter.id,"text")}}>+ Text</button><button type="button" onClick={event => {event.stopPropagation();addSection(chapter.id,"screenplay")}}>+ Screenplay</button><button type="button" onClick={event => {event.stopPropagation();addSection(chapter.id,"images")}}>+ Images</button><button type="button" onClick={event => {event.stopPropagation();addSection(chapter.id,"comic")}}>+ Comic scroll</button><button type="button" onClick={event => {event.stopPropagation();addSection(chapter.id,"video")}}>+ Video</button></div>
          </article>
          {canvasDropPreview?.kind === "chapter" && canvasDropPreview.targetId === chapter.id && canvasDropPreview.after && canvasPlaceholder("chapter")}
          </Fragment>)}
          <button type="button" className="sb-add-chapter" onClick={addChapter}>+ Add chapter</button>
        </main>
      </div>
    </>}
    {libraryOpen && <StoryboardLibraryDialog title="Image library" onClose={() => setLibraryOpen(false)}>
      <StoryboardLibraryUpload chapters={libraryChapters} defaultChapter={document.chapters.find(chapter => chapter.id === selectedId || chapter.sections.some(section => section.id === selectedId))?.title} onChapterCreated={chapter => { addLibraryChapter(chapter); setLibraryFilter(chapter); setLibraryLimit(48); }} onUploaded={src => { addLibraryImage(src); setLibraryFilter(libraryChapterOf(src)); setLibrarySearch(""); setLibraryLimit(48); }} />
      <div className="sb-library-filters"><select aria-label="Filter library by chapter" value={libraryFilter} onChange={event => { setLibraryFilter(event.target.value); setLibraryLimit(48); }}><option value="">All chapters</option>{libraryChapters.map(chapter => <option key={chapter}>{chapter}</option>)}</select><input aria-label="Search library" placeholder="Search frames…" value={librarySearch} onChange={event => { setLibrarySearch(event.target.value); setLibraryLimit(48); }} /></div>
      <div className="sb-library-view-row"><label className="sb-library-show-hidden"><input type="checkbox" checked={showHiddenLibrary} onChange={event => { setShowHiddenLibrary(event.target.checked); setLibraryLimit(48); }} /> Show removed frames ({hiddenLibrary.length})</label><div className="sb-library-view-switch" role="group" aria-label="Library view"><button type="button" aria-pressed={libraryView === "grid"} onClick={() => setLibraryView("grid")}>Grid</button><button type="button" aria-pressed={libraryView === "list"} onClick={() => { setLibraryView("list"); setLibraryLimit(48); }}>List</button></div></div>
      {libraryError && <p className="sb-upload-error" role="alert">{libraryError}</p>}
      <p className="sb-muted">{visibleLibrary.length} frames</p>
      <div className={`sb-library-results${libraryView === "list" ? " is-list" : ""}`}>{orderedLibrary.slice(0, libraryLimit).map(src => <div className={`sb-library-frame${hiddenLibrary.includes(src) ? " is-hidden" : ""}`} key={src}>
        <span><Image src={src} alt="" fill unoptimized sizes="120px" /></span>
        <small>{libraryChapterOf(src)} · {libraryFilename(src)}</small>
        {hiddenLibrary.includes(src) ? <button type="button" className="sb-library-delete" disabled={!!deletingLibraryImage} onClick={() => void restoreLibraryImage(src)}>{deletingLibraryImage === src ? "Restoring…" : "Restore"}</button>
          : <button type="button" className="sb-library-delete" aria-label={`${src.startsWith("/storyboard/") ? "Remove" : "Delete"} ${decodeURIComponent(src.split("/").at(-1) || "image")}`} disabled={!!deletingLibraryImage || (!src.startsWith("/storyboard/") && imageIsUsed(src))} title={!src.startsWith("/storyboard/") && imageIsUsed(src) ? "Used in the draft or published storyboard" : src.startsWith("/storyboard/") ? "Remove from library" : "Delete uploaded image"} onClick={() => void deleteLibraryImage(src)}>{deletingLibraryImage === src ? "Removing…" : src.startsWith("/storyboard/") ? "Remove" : "Delete"}</button>}
      </div>)}</div>
      {visibleLibrary.length > libraryLimit && <button type="button" className="sb-library-more" onClick={() => setLibraryLimit(limit => limit + 48)}>Show more frames</button>}
    </StoryboardLibraryDialog>}
  </div>;
}

function ImageSectionPreview({ section }: { section: Extract<Section, { kind: "images" }> }) {
  const images = [...section.images].sort((a, b) => a.slot - b.slot);
  return <div className="sb-image-preview" aria-label={`${images.length} of ${capacity[section.layout]} image slots filled`}>
    <div className="sb-image-preview-thumbs">
      {images.slice(0, 3).map(image => <span className="sb-image-preview-thumb" key={image.id}><Image src={image.src} alt="" fill unoptimized sizes="70px" /></span>)}
      {images.length > 3 && <span className="sb-image-preview-more">+{images.length - 3}</span>}
      {images.length === 0 && <span className="sb-image-preview-empty">No images</span>}
    </div>
  </div>;
}

function ImageSectionEditor({ section, library, libraryChapters, defaultChapter, onUploaded, onChapterCreated, onChange, uploading, setUploading, startDrag, drag }: {
  section: Extract<Section,{kind:"images"}>; library: string[]; libraryChapters: string[]; defaultChapter: string; onUploaded: (src: string) => void; onChapterCreated: (chapter: string) => void; onChange: (fn: (section: Extract<Section,{kind:"images"}>) => void) => void;
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
  const matches = library.filter(src => (!libraryChapter || libraryChapterOf(src) === libraryChapter) && decodeURIComponent(src).toLocaleLowerCase("en-US").includes(libraryQuery.trim().toLocaleLowerCase("en-US")));
  function imageLabel(src: string) {
    const parts = decodeURIComponent(src).split("/");
    const chapter = libraryChapterOf(src);
    const frame = parts.at(-1)?.match(/(?:NOH_color_)?0*(\d+)_cropped/i)?.[1];
    return frame ? `${chapter} · Frame ${frame}` : `${chapter} · ${parts.at(-1)?.replace(/^[0-9]+-[0-9a-f-]{36}-/, "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") || "Image"}`;
  }
  function pickImage(src: string) {
    if (pickTarget === null) return;
    onChange(s => putImageInSlot(s, pickTarget, src));
    setPickTarget(null);
  }
  function setLayout(value: typeof section.layout) {
    if (section.images.some(image => image.slot >= capacity[value]) && !window.confirm("The new layout has fewer slots. Images outside the new slots will be removed. Continue?")) return;
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
  return <div className="sb-image-editor"><label>Layout <select aria-label="Image layout" value={section.layout} onChange={event => setLayout(event.target.value as typeof section.layout)}><option value="single">Single image</option><option value="1x2">1 row × 2 images</option><option value="2x2">2 rows × 2 images</option><option value="2x3">2 rows × 3 images</option><option value="3x3">3 rows × 3 images</option></select></label>
    <div className={`sb-image-cards storyboard-image-grid storyboard-layout-${section.layout}`}>
      {Array.from({length:total},(_,slot)=>{
        const image = section.images.find(item => item.slot === slot);
        return image ? <div key={`slot-${slot}`} data-slot={slot} className={`sb-image-card sb-file-dropzone ${dropTarget===slot?"is-file-over":""}`} onDragOver={event=>{if(isFileDrag(event))fileDragOver(event,slot);else if(drag.current?.kind==="image")event.preventDefault();}} onDragLeave={event=>fileDragLeave(event,slot)} onDrop={event=>{if(isFileDrag(event))fileDrop(event,slot);else dropImage(event,slot);}}>
          <div className="sb-image-controls"><button type="button" className="sb-grip" draggable onDragStart={event=>startDrag(event,{kind:"image",id:image.id,sectionId:section.id})} onDragEnd={()=>{drag.current=null;}} aria-label={`Drag image ${slot+1}`}>⋮⋮</button><span>Image {slot+1}</span><button type="button" aria-label={`Move image ${slot+1} backward`} disabled={slot===0} onClick={()=>moveImage(image.id,-1)}>←</button><button type="button" aria-label={`Move image ${slot+1} forward`} disabled={slot===total-1} onClick={()=>moveImage(image.id,1)}>→</button><button type="button" aria-label={`Remove image ${slot+1}`} onClick={()=>onChange(s=>{s.images=s.images.filter(i=>i.id!==image.id);})}>×</button></div>
          <div className="storyboard-image-wrap"><Image src={image.src} alt={image.description||`Image ${slot+1}`} fill unoptimized sizes="(max-width: 700px) 100vw, 50vw" /><span className="sb-drop-overlay" aria-hidden="true">{uploading===uploadKey(slot)?"Uploading…":"Drop image to replace"}</span></div>
          <button type="button" className="sb-library-open" onClick={() => {setPickTarget(slot);setLibraryQuery("");setLibraryLimit(18);}}>Replace from image library</button>
          <label className="sb-upload">{uploading===uploadKey(slot)?"Uploading…":"Upload replacement"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={!!uploading} onChange={event=>uploadFromInput(event,slot)} /></label>
        </div> : <div key={`slot-${slot}`} data-slot={slot} role="group" aria-label={`Image slot ${slot+1}`} className={`sb-image-placeholder sb-file-dropzone ${dropTarget===slot?"is-file-over":""}`} onDragOver={event=>{if(isFileDrag(event))fileDragOver(event,slot);else if(drag.current?.kind==="image")event.preventDefault();}} onDragLeave={event=>fileDragLeave(event,slot)} onDrop={event=>{if(isFileDrag(event))fileDrop(event,slot);else dropImage(event,slot);}}><svg className="sb-drop-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 4v15m0 0-5-5m5 5 5-5M6 23v4h20v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg><p>Image {slot+1}</p><button type="button" className="sb-library-open" onClick={() => {setPickTarget(slot);setLibraryQuery("");setLibraryLimit(18);}}>Choose from image library</button><label className="sb-upload">{uploading===uploadKey(slot)?"Uploading…":"Upload image"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={!!uploading} onChange={event=>uploadFromInput(event,slot)} /></label></div>;
      })}
    </div>
    {uploadError && <p className="sb-upload-error" role="alert">{uploadError}</p>}
    {pickTarget !== null && <StoryboardLibraryDialog title={section.images.some(image=>image.slot===pickTarget) ? `Replace image ${pickTarget+1}` : `Choose image for slot ${pickTarget+1}`} onClose={() => setPickTarget(null)}><div className="sb-library-picker"><StoryboardLibraryUpload chapters={libraryChapters} defaultChapter={defaultChapter} onChapterCreated={onChapterCreated} onUploaded={src => { onUploaded(src); setLibraryChapter(libraryChapterOf(src)); setLibraryQuery(""); setLibraryLimit(18); }} /><div className="sb-library-filters"><select aria-label="Filter image library by chapter" value={libraryChapter} onChange={event => {setLibraryChapter(event.target.value);setLibraryLimit(18);}}><option value="">All chapters</option>{libraryChapters.map(chapter => <option key={chapter} value={chapter}>{chapter}</option>)}</select><input aria-label="Search image library" placeholder="Search filename or frame number…" value={libraryQuery} onChange={event => {setLibraryQuery(event.target.value);setLibraryLimit(18);}} /></div><p className="sb-muted">{matches.length} results · choose a thumbnail</p><div className="sb-library-results">{matches.slice(0,libraryLimit).map(src => <button type="button" key={src} title={decodeURIComponent(src)} onClick={() => pickImage(src)}><span><Image src={src} alt="" fill unoptimized sizes="120px" /></span><small>{imageLabel(src)}</small></button>)}</div>{matches.length > libraryLimit && <button type="button" className="sb-library-more" onClick={() => setLibraryLimit(value => value + 18)}>Show more images</button>}</div></StoryboardLibraryDialog>}
  </div>;
}
