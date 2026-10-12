"use client";

import { useState } from "react";
import { safeImageSource, type Section } from "@/lib/storyboard/model";
import "./video-editor.css";

type VideoSection = Extract<Section, { kind: "video" }>;

export function VideoSectionEditor({ section, onChange }: { section: VideoSection; onChange: (src: string) => void }) {
  const [url, setUrl] = useState(section.src);
  const [uploading, setUploading] = useState(false);
  const [fileOver, setFileOver] = useState(false);
  const [error, setError] = useState("");

  function useUrl(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = url.trim();
    if (next && !safeImageSource(next)) { setError("Use a site path or a Supabase or Vercel Blob video URL."); return; }
    onChange(next);
    setError("");
  }

  async function upload(file: File) {
    if (!(["video/mp4", "video/webm"].includes(file.type) && file.size > 0 && file.size <= 50 * 1024 * 1024)) {
      setError("Choose an MP4 or WebM video under 50 MB.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const prepare = await fetch("/api/storyboard/video-upload", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: file.type, size: file.size }),
      });
      const prepared = await prepare.json();
      if (!prepare.ok) throw new Error(prepared.error || "Could not prepare video upload.");
      let src: string;
      if (prepared.mode === "local") {
        const form = new FormData();
        form.set("video", file);
        const response = await fetch("/api/storyboard/video-upload", { method: "POST", body: form });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Video upload failed.");
        src = result.src;
      } else {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !anonKey) throw new Error("Video storage is not configured.");
        const { createClient } = await import("@supabase/supabase-js");
        const client = createClient(supabaseUrl, anonKey);
        const { error: uploadError } = await client.storage.from("storyboard-videos")
          .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
        if (uploadError) throw uploadError;
        src = prepared.src;
      }
      onChange(src);
      setUrl(src);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Video upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return <div className="sb-video-editor">
    <div className={`sb-video-stage${fileOver ? " is-file-over" : ""}`}
      onDragOver={event => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.stopPropagation(); setFileOver(true); } }}
      onDragLeave={event => { event.stopPropagation(); setFileOver(false); }}
      onDrop={event => { if (!event.dataTransfer.files.length) return; event.preventDefault(); event.stopPropagation(); setFileOver(false); if (!uploading) void upload(event.dataTransfer.files[0]); }}>
      {section.src ? <video src={section.src} controls playsInline preload="metadata" aria-label={section.title} /> :
        <span>Drop an MP4 or WebM video here</span>}
    </div>
    <div className="sb-video-actions">
      <label className="sb-video-upload">{uploading ? "Uploading…" : section.src ? "Replace video" : "Upload video"}
        <input type="file" accept="video/mp4,video/webm" disabled={uploading} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
      </label>
      {section.src && <button type="button" onClick={() => { onChange(""); setUrl(""); setError(""); }}>Remove video</button>}
    </div>
    <form className="sb-video-url" onSubmit={useUrl}>
      <label htmlFor={`video-url-${section.id}`}>Video URL</label>
      <div><input id={`video-url-${section.id}`} type="text" inputMode="url" value={url} placeholder="https://…/video.mp4 or /storyboard/video.mp4" onChange={event => setUrl(event.target.value)} />
        <button type="submit">Use URL</button></div>
    </form>
    {error && <p className="sb-upload-error" role="alert">{error}</p>}
    <p className="sb-video-note">16:9 · MP4 or WebM · up to 50 MB</p>
  </div>;
}
