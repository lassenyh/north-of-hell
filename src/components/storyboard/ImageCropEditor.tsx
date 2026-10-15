"use client";

import { useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { imageCropStyle, normalizeImageCrop, type ImageCrop } from "@/lib/storyboard/image-crop";
import "./image-crop.css";

export function ImageCropEditor({ src, alt, value, onChange, style, fit = "contain", overlay = false, onClose }: {
  src: string; alt: string; value?: ImageCrop; onChange: (crop: ImageCrop) => void;
  style?: CSSProperties; fit?: "contain" | "cover" | "fill"; overlay?: boolean; onClose?: () => void;
}) {
  const [editing, setEditing] = useState(overlay);
  const drag = useRef<{ x: number; y: number; width: number; height: number; crop: ImageCrop } | null>(null);
  const crop = normalizeImageCrop(value);
  const close = () => { drag.current = null; setEditing(false); onClose?.(); };
  return <div className={`sb-image-crop${overlay ? " is-overlay" : ""}${editing ? " is-editing" : ""}`} style={style} onPointerDown={event => event.stopPropagation()}>
    <div className="sb-image-crop-viewport" role="group" tabIndex={0} aria-label={`Image framing: ${alt}`} title="Double-click or press Enter to adjust image framing" onDoubleClick={event => { event.stopPropagation(); setEditing(true); }} onKeyDown={event => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter") { event.preventDefault(); setEditing(true); }
      if (event.key === "Escape") { event.stopPropagation(); close(); }
      if (editing && crop.scale > 1 && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        onChange(normalizeImageCrop({ ...crop, x: crop.x + (event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0), y: crop.y + (event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0) }));
      }
    }} onPointerDown={event => {
      if (!editing || crop.scale <= 1 || event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      drag.current = { x: event.clientX, y: event.clientY, width: rect.width, height: rect.height, crop };
      event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={event => {
      const start = drag.current;
      if (!start) return;
      event.stopPropagation();
      onChange(normalizeImageCrop({ ...start.crop, x: start.crop.x + (event.clientX - start.x) / start.width * 100, y: start.crop.y + (event.clientY - start.y) / start.height * 100 }));
    }} onPointerUp={event => { if (drag.current) { drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); } }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
      {!overlay && <Image src={src} alt={alt} fill unoptimized draggable={false} sizes="(max-width: 700px) 100vw, 50vw" style={{ ...imageCropStyle(crop), objectFit: fit }} />}
    </div>
    {editing && <div className="sb-image-crop-controls" onDoubleClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <label>Scale <output>{Math.round(crop.scale * 100)}%</output><input aria-label={`Image scale: ${alt}`} type="range" min="100" max="400" step="1" value={Math.round(crop.scale * 100)} onChange={event => onChange(normalizeImageCrop({ ...crop, scale: Number(event.target.value) / 100 }))} /></label>
      <span className="sb-image-crop-hint">{crop.scale > 1 ? "Drag image to position" : "Zoom in to move image"}</span>
      <button type="button" onClick={() => onChange({ scale: 1, x: 0, y: 0 })}>Reset</button><button type="button" onClick={close}>Done</button>
    </div>}
  </div>;
}

export function ImageSourceIcon({ upload = false }: { upload?: boolean }) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">{upload ? <path d="M10 13V3m-4 4 4-4 4 4M3 12v5h14v-5" /> : <><rect x="3" y="3" width="14" height="14" rx="1.5" /><circle cx="7" cy="7" r="1.2" /><path d="m4 15 4-4 3 3 2-2 4 4" /></>}</svg>;
}
