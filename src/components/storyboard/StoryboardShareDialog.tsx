"use client";

import { useRef, useState } from "react";
import { createShareSnapshotAction } from "@/app/admin/storyboard/actions";
import { StoryboardLibraryDialog } from "./StoryboardLibraryDialog";

type ShareMode = "live" | "fixed";

export function StoryboardShareDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<ShareMode>("live");
  const [links, setLinks] = useState<Record<ShareMode, string>>({ live: "", fixed: "" });
  const [fixedVersion, setFixedVersion] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const url = links[mode];

  async function generateLink() {
    setMessage("");
    if (mode === "live") {
      setLinks(current => ({ ...current, live: new URL("/storyboard/share", window.location.origin).href }));
      return;
    }
    setCreating(true);
    try {
      const result = await createShareSnapshotAction();
      if (!result.ok) throw new Error(result.error);
      setFixedVersion(result.publishedVersion);
      setLinks(current => ({ ...current, fixed: new URL(`/storyboard/share/${result.id}`, window.location.origin).href }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create a fixed link.");
    } finally {
      setCreating(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied");
    } catch {
      inputRef.current?.select();
      setMessage("Copy the selected link manually.");
    }
  }

  return <StoryboardLibraryDialog title="Share storyboard" onClose={onClose} className="sb-share-dialog">
    <div className="sb-share-content">
      <p>Share the published storyboard without the rest of the website. Draft changes are never included.</p>
      <fieldset className="sb-share-options">
        <legend>Link type</legend>
        <label><input type="radio" name="storyboard-share-mode" value="live" checked={mode === "live"} onChange={() => { setMode("live"); setMessage(""); }} /><span><strong>Live</strong><small>Always shows the latest published version.</small></span></label>
        <label><input type="radio" name="storyboard-share-mode" value="fixed" checked={mode === "fixed"} onChange={() => { setMode("fixed"); setMessage(""); }} /><span><strong>Current version</strong><small>Keeps the published version as it is now.</small></span></label>
      </fieldset>
      <button type="button" className="sb-share-generate" onClick={() => void generateLink()} disabled={creating}>{creating ? "Creating…" : mode === "live" ? "Generate live link" : "Create fixed link"}</button>
      {url && <div className="sb-share-result">
        <label htmlFor="storyboard-share-url">{mode === "live" ? "Live link" : `Fixed link${fixedVersion === null ? "" : ` · Published v${fixedVersion}`}`}</label>
        <input ref={inputRef} id="storyboard-share-url" type="url" readOnly value={url} onFocus={event => event.currentTarget.select()} />
        <div className="sb-share-actions">
          <button type="button" onClick={() => void copyLink()}>Copy link</button>
          <a href={url} target="_blank" rel="noopener noreferrer">Open link ↗</a>
        </div>
        {new URL(url).hostname === "localhost" && <p className="sb-share-note">This local link works only on this computer. Without a server key, live sharing uses the last Supabase publication synced into this workspace. Once deployed, generate the link from the live studio to share it with others.</p>}
      </div>}
      {message && <p className="sb-share-message" role="status">{message}</p>}
    </div>
  </StoryboardLibraryDialog>;
}
