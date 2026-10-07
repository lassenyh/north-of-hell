"use client";

import { useRef, useState } from "react";
export function StoryboardLibraryUpload({ chapters, defaultChapter, onUploaded, onChapterCreated }: { chapters: string[]; defaultChapter?: string; onUploaded: (src: string) => void; onChapterCreated: (chapter: string) => void }) {
  const [chapter, setChapter] = useState(defaultChapter && chapters.includes(defaultChapter) ? defaultChapter : chapters[0] || "__new__");
  const [newChapter, setNewChapter] = useState("");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const targetChapter = chapter === "__new__" ? "" : chapter;

  async function createChapter() {
    const name = newChapter.trim();
    if (!name || name.length > 120) { setError("Choose a chapter name (up to 120 characters)."); return; }
    setCreating(true); setError(""); setProgress("");
    try {
      const response = await fetch("/api/storyboard/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chapter: name }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create chapter.");
      onChapterCreated(result.chapter);
      setChapter(result.chapter);
      setNewChapter("");
      setProgress(`Chapter ${result.chapter} created.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create chapter."); }
    finally { setCreating(false); }
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (!targetChapter) { setError("Create a chapter before uploading frames."); return; }
    setError("");
    let completed = 0;
    for (const file of Array.from(files)) {
      setProgress(`Uploading ${completed + 1} of ${files.length}: ${file.name}`);
      try {
        const form = new FormData(); form.set("chapter", targetChapter); form.set("image", file);
        const response = await fetch("/api/storyboard/library", { method: "POST", body: form });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Upload failed.");
        onUploaded(result.src);
        completed++;
      } catch (cause) { setError(`${file.name}: ${cause instanceof Error ? cause.message : "Upload failed."}`); break; }
    }
    setProgress(completed ? `${completed} ${completed === 1 ? "frame" : "frames"} added to ${targetChapter}.` : "");
    if (inputRef.current) inputRef.current.value = "";
  }

  return <div className="sb-library-upload">
    <label>Chapter <select aria-label="Upload frames to chapter" value={chapter} disabled={creating || progress.startsWith("Uploading")} onChange={event => { setChapter(event.target.value); setError(""); }}>{chapters.map(name => <option key={name} value={name}>{name}</option>)}<option value="__new__">+ New chapter in library</option></select></label>
    {chapter === "__new__" && <><label>New chapter name <input aria-label="New library chapter name" value={newChapter} maxLength={120} onChange={event => setNewChapter(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void createChapter(); } }} placeholder="Chapter name" /></label><button type="button" className="sb-library-create-chapter" disabled={creating} onClick={() => void createChapter()}>{creating ? "Creating…" : "Create chapter"}</button></>}
    <label className="sb-library-upload-button">+ Upload frames<input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple disabled={creating || progress.startsWith("Uploading") || !targetChapter} onChange={event => void upload(event.target.files)} /></label>
    {progress && <span role="status">{progress}</span>}{error && <span className="sb-upload-error" role="alert">{error}</span>}
  </div>;
}
