"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { libraryChapter } from "@/lib/storyboard/library-chapter";
import { StoryboardLibraryDialog } from "./StoryboardLibraryDialog";
import { StoryboardErrorMessage } from "./StoryboardErrorMessage";
import "./comic-insert.css";

const sort = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const filename = (src: string) => decodeURIComponent(src.split("/").at(-1) || "Image").replace(/^[0-9]+-[0-9a-f-]{36}-/, "");

export function ComicInsertDialog({ library, chapters, chapterName, remaining, onSingle, onBatch, onUploaded, onClose }: {
  library: string[]; chapters: string[]; chapterName: string; remaining: number;
  onSingle: () => void; onBatch: (sources: string[]) => void; onUploaded: (src: string) => void; onClose: () => void;
}) {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(48);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [fileOver, setFileOver] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadLock = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  const results = library.filter(src => (!filter || libraryChapter(src) === filter) && filename(src).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a, b) => sort.compare(filename(a), filename(b)));

  function toggle(src: string) {
    setError("");
    setSelected(current => current.includes(src) ? current.filter(item => item !== src) : current.length < remaining ? [...current, src] : current);
  }
  async function upload(files: File[]) {
    if (!files.length || uploadLock.current) return;
    if (selected.length + files.length > remaining) { setError(`This chapter has room for ${remaining} more sections.`); return; }
    const ordered = [...files].sort((a, b) => sort.compare(a.name, b.name));
    const invalid = ordered.find(file => !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024);
    if (invalid) { setError(`${invalid.name}: choose a JPG, PNG, WebP or GIF under 10 MB.`); return; }
    uploadLock.current = true;
    setUploading(true); setError("");
    const abort = new AbortController(); controller.current = abort;
    try {
      for (const [index, file] of ordered.entries()) {
        setProgress(`Uploading ${index + 1} of ${ordered.length}: ${file.name}`);
        const form = new FormData(); form.set("chapter", chapterName); form.set("image", file);
        const response = await fetch("/api/storyboard/library", { method: "POST", body: form, signal: abort.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Could not upload ${file.name}.`);
        if (abort.signal.aborted) return;
        onUploaded(result.src);
        setSelected(current => [...current, result.src]);
      }
      setProgress(`${ordered.length} images uploaded and selected.`);
    } catch (cause) {
      if (!abort.signal.aborted) { setError(cause instanceof Error ? cause.message : "Upload failed."); setProgress("Uploaded images remain selected. Retry the remaining files."); }
    } finally {
      uploadLock.current = false;
      if (!abort.signal.aborted) setUploading(false);
    }
  }
  return <StoryboardLibraryDialog title={`Add comic scroll · ${chapterName}`} onClose={onClose} className="sb-comic-insert-dialog">
    <fieldset className="sb-comic-insert-mode" disabled={uploading}><legend>How many images?</legend>{([ ["single", "Single image"], ["batch", "Batch"] ] as const).map(([value, label]) => <label key={value}><input type="radio" name="comic-insert-mode" checked={mode === value} onChange={() => setMode(value)} />{label}</label>)}</fieldset>
    <p className="sb-comic-insert-description">{mode === "single" ? "Add one empty comic scroll, then choose its image." : "One comic scroll per image. Select in the order you want, or drop files below. Uploaded files use filename order."} All sections start with 200 px above, 0 px below and a 16:9 frame.</p>
    {mode === "batch" && <>
      <div className={`sb-comic-batch-drop${fileOver ? " is-file-over" : ""}`} aria-label="Drop images for comic scroll" onDragOver={event => { if (!event.dataTransfer.types.includes("Files")) return; event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = uploading ? "none" : "copy"; setFileOver(!uploading); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFileOver(false); }} onDrop={event => { event.preventDefault(); event.stopPropagation(); setFileOver(false); if (!uploadLock.current) void upload(Array.from(event.dataTransfer.files)); }}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" /></svg><strong>{uploading ? "Uploading images…" : "Drop multiple images here"}</strong><span>JPG, PNG, WebP or GIF · up to 10 MB each</span>
        <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()}>Choose files</button><input ref={fileInput} className="sb-comic-batch-input" aria-label="Upload images for comic scroll" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploading} onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ""; void upload(files); }} />
      </div>
      {progress && <p role="status">{progress}</p>}
      <div className="sb-library-filters"><select aria-label="Filter comic images by chapter" value={filter} onChange={event => { setFilter(event.target.value); setLimit(48); }}><option value="">All chapters</option>{chapters.map(chapter => <option key={chapter}>{chapter}</option>)}</select><input aria-label="Search comic images" placeholder="Search filename or frame number…" value={query} onChange={event => { setQuery(event.target.value); setLimit(48); }} /></div>
      <div className="sb-comic-batch-selection"><span role="status">{selected.length} selected · {results.length} images</span><button type="button" disabled={uploading || !selected.length} onClick={() => setSelected([])}>Clear selection</button></div>
      <div className="sb-library-results sb-comic-batch-results">{results.slice(0, limit).map(src => {
        const position = selected.indexOf(src);
        return <button type="button" key={src} aria-label={`Select ${filename(src)}`} aria-pressed={position >= 0} disabled={uploading || (position < 0 && selected.length >= remaining)} onClick={() => toggle(src)}><span><Image src={src} alt="" fill unoptimized sizes="150px" />{position >= 0 && <b className="sb-comic-batch-number">{position + 1}</b>}</span><small>{filename(src)}</small></button>;
      })}</div>
      {!results.length && <p>No images match. Upload images above or change the filter.</p>}
      {results.length > limit && <button type="button" className="sb-library-more" onClick={() => setLimit(value => value + 48)}>Show more images</button>}
    </>}
    {error && <p className="sb-upload-error" role="alert"><StoryboardErrorMessage message={error} /></p>}
    <div className="sb-comic-insert-footer"><button type="button" onClick={onClose}>Cancel</button><button type="button" className="sb-comic-insert-confirm" disabled={uploading || !remaining || (mode === "batch" && !selected.length)} onClick={() => { try { if (mode === "single") onSingle(); else onBatch(selected); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add comic sections."); } }}>{mode === "single" ? "Add single image" : `Add ${selected.length} comic scrolls`}</button></div>
  </StoryboardLibraryDialog>;
}
