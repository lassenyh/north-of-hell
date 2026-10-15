"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { bubbleFlipPlacement, comicHeight, comicImageHeight, fitComicContent, layoutBubbleText, minimumComicSpace, renderComicSvg, soundBounds, updateComicSpace } from "@/lib/storyboard/comic-svg";
import { newId, type ComicBubble, type ComicSection, type ComicSound } from "@/lib/storyboard/model";
import { StoryboardLibraryDialog } from "./StoryboardLibraryDialog";
import { StoryboardLibraryUpload } from "./StoryboardLibraryUpload";
import { libraryChapter } from "@/lib/storyboard/library-chapter";
import "./comic-editor.css";

function Slider({ label, value, min, max, unit = "px", dragOnly = false, disabled = false, onChange }: { label: string; value: number; min: number; max: number; unit?: string; dragOnly?: boolean; disabled?: boolean; onChange: (value: number) => void }) {
  return <label className="comic-slider"><span>{label}<output>{value}{unit}</output></span><input type="range" aria-label={label} min={min} max={Math.max(min, max)} step="1" value={value} disabled={disabled} onPointerDown={dragOnly ? event => {
    // A track click on a position slider would jump the item across the canvas.
    const rect = event.currentTarget.getBoundingClientRect();
    const thumbRadius = 9;
    const ratio = max > min ? (value - min) / (max - min) : 0;
    const thumbX = rect.left + thumbRadius + (rect.width - thumbRadius * 2) * ratio;
    if (Math.abs(event.clientX - thumbX) > 16) event.preventDefault();
  } : undefined} onChange={event => onChange(Number(event.target.value))} /></label>;
}

type Change = (fn: (section: ComicSection) => void) => void;
const comicLibraryDragType = "application/x-north-of-hell-comic-image";
type DragState =
  | { kind: "bubble"; id: string; mode: "move" | "resize" | "tail"; startX: number; startY: number; clientX: number; clientY: number; scale: number; bubble: ComicBubble; members: ComicBubble[] }
  | { kind: "sound"; id: string; mode: "move" | "size" | "rotate"; startX: number; startY: number; clientX: number; clientY: number; scale: number; startDistance: number; startAngle: number; sound: ComicSound };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const escapeAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
function aimTail(bubble: ComicBubble, totalHeight: number) {
  if (bubble.tailSide === "top") { bubble.tailX = clamp(bubble.x + bubble.width * .55, 0, 800); bubble.tailY = clamp(bubble.y - 55, 0, totalHeight); }
  if (bubble.tailSide === "bottom") { bubble.tailX = clamp(bubble.x + bubble.width * .55, 0, 800); bubble.tailY = clamp(bubble.y + bubble.height + 55, 0, totalHeight); }
  if (bubble.tailSide === "left") { bubble.tailX = clamp(bubble.x - 55, 0, 800); bubble.tailY = clamp(bubble.y + bubble.height * .55, 0, totalHeight); }
  if (bubble.tailSide === "right") { bubble.tailX = clamp(bubble.x + bubble.width + 55, 0, 800); bubble.tailY = clamp(bubble.y + bubble.height * .55, 0, totalHeight); }
}
function constrainTail(bubble: ComicBubble, totalHeight: number) {
  if (bubble.tailSide === "top") bubble.tailY = clamp(bubble.tailY, 0, Math.max(0, bubble.y - 5));
  if (bubble.tailSide === "bottom") bubble.tailY = clamp(bubble.tailY, Math.min(totalHeight, bubble.y + bubble.height + 5), totalHeight);
  if (bubble.tailSide === "left") bubble.tailX = clamp(bubble.tailX, 0, Math.max(0, bubble.x - 5));
  if (bubble.tailSide === "right") bubble.tailX = clamp(bubble.tailX, Math.min(800, bubble.x + bubble.width + 5), 800);
}
function bubbleMembers(bubbles: ComicBubble[], bubble: ComicBubble) {
  return bubble.parentId ? [bubble] : [bubble, ...bubbles.filter(item => item.parentId === bubble.id)];
}
function moveBubbleMembers(section: ComicSection, originals: ComicBubble[], dx: number, dy: number) {
  const totalHeight = comicHeight(section);
  const x = clamp(dx, -Math.min(...originals.map(item => item.x)), 800 - Math.max(...originals.map(item => item.x + item.width)));
  const y = clamp(dy, -Math.min(...originals.map(item => item.y)), totalHeight - Math.max(...originals.map(item => item.y + item.height)));
  for (const original of originals) {
    const item = section.bubbles.find(bubble => bubble.id === original.id);
    if (!item) continue;
    item.x = Math.round(original.x + x); item.y = Math.round(original.y + y);
    item.tailX = Math.round(clamp(original.tailX + x, 0, 800));
    item.tailY = Math.round(clamp(original.tailY + y, 0, totalHeight));
    constrainTail(item, totalHeight);
  }
}

export function ComicSectionEditor({ section, library, libraryChapters, defaultChapter, onUploaded, onChapterCreated, onChange }: { section: ComicSection; library: string[]; libraryChapters: string[]; defaultChapter: string; onUploaded: (src: string) => void; onChapterCreated: (chapter: string) => void; onChange: Change }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [chapter, setChapter] = useState("");
  const [limit, setLimit] = useState(24);
  const [mobile, setMobile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileOver, setFileOver] = useState(false);
  const [error, setError] = useState("");
  const drag = useRef<DragState | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const inlineTextRef = useRef<HTMLTextAreaElement>(null);
  const inlineSoundRef = useRef<HTMLTextAreaElement>(null);
  const activeBubble = section.bubbles.find(item => item.id === selected);
  const activeRoot = activeBubble?.parentId ? section.bubbles.find(item => item.id === activeBubble.parentId) : activeBubble;
  const activeCompanions = activeRoot ? section.bubbles.filter(item => item.parentId === activeRoot.id) : [];
  const activeMoveMembers = activeBubble ? bubbleMembers(section.bubbles, activeBubble) : [];
  const activeMoveMinX = activeBubble ? activeBubble.x - Math.min(...activeMoveMembers.map(item => item.x)) : 0;
  const activeMoveMaxX = activeBubble ? activeBubble.x + 800 - Math.max(...activeMoveMembers.map(item => item.x + item.width)) : 800;
  const activeMoveMinY = activeBubble ? activeBubble.y - Math.min(...activeMoveMembers.map(item => item.y)) : 0;
  const activeMoveMaxY = activeBubble ? activeBubble.y + comicHeight(section) - Math.max(...activeMoveMembers.map(item => item.y + item.height)) : comicHeight(section);
  const activeSound = section.sounds.find(item => item.id === selected);
  const activeTextLayout = activeBubble ? layoutBubbleText(activeBubble) : null;
  const activeBubbleMaxWidth = activeBubble?.shape === "rectangle"
    ? Math.min(800, Math.round(2 * Math.min(activeBubble.x + activeBubble.width / 2, 800 - activeBubble.x - activeBubble.width / 2)))
    : activeBubble ? Math.min(760, 800 - activeBubble.x) : 760;
  const activeBubbleZone = activeBubble
    ? activeBubble.y + activeBubble.height / 2 < section.topSpace ? "above"
      : activeBubble.y + activeBubble.height / 2 < section.topSpace + comicImageHeight(section) ? "image" : "below"
    : null;
  const canCenterVertically = activeBubbleZone === "above" ? section.topSpace >= (activeBubble?.height ?? 0)
    : activeBubbleZone === "below" ? section.bottomSpace >= (activeBubble?.height ?? 0) : false;
  const verticalCenterTitle = activeBubbleZone === "image"
    ? "Move text above or below the image before centering"
    : canCenterVertically ? `Center text vertically in space ${activeBubbleZone}`
      : `Increase space ${activeBubbleZone} so the text fits before centering`;
  const emptyImage = !section.src && section.bubbles.length === 0 && section.sounds.length === 0;
  const chapters = libraryChapters;
  const matches = library.filter(src => (!chapter || libraryChapter(src) === chapter) && decodeURIComponent(src).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  function updateBubble(id: string, fn: (bubble: ComicBubble, next: ComicSection) => void) {
    onChange(next => { const bubble = next.bubbles.find(item => item.id === id); if (bubble) fn(bubble, next); next.renderedSrc = undefined; });
  }
  function updateSound(id: string, fn: (sound: ComicSound) => void) {
    onChange(next => { const sound = next.sounds.find(item => item.id === id); if (sound) fn(sound); next.renderedSrc = undefined; });
  }
  async function chooseImage(src: string) {
    setError("");
    try {
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error("The image could not be opened."));
        image.src = src;
      });
      if (!dimensions.width || !dimensions.height) throw new Error("The image has no dimensions.");
      onChange(next => {
        const oldBottom = next.topSpace + comicImageHeight(next);
        const oldImageHeight = comicImageHeight(next);
        next.src = src; next.imageWidth = dimensions.width; next.imageHeight = dimensions.height;
        const delta = comicImageHeight(next) - oldImageHeight;
        for (const bubble of next.bubbles) {
          if (bubble.y >= oldBottom) bubble.y += delta;
          if (bubble.tailY >= oldBottom) bubble.tailY += delta;
        }
        for (const sound of next.sounds) if (sound.y >= oldBottom) sound.y += delta;
        fitComicContent(next);
        next.renderedSrc = undefined;
      });
      setPicker(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Image selection failed."); }
  }
  async function uploadFile(file: File) {
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024) {
      setError("Choose one JPG, PNG, WebP or GIF under 10 MB."); return;
    }
    setUploading(true); setError("");
    try {
      const form = new FormData(); form.set("image", file);
      const response = await fetch("/api/storyboard/upload", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Upload failed.");
      await chooseImage(body.src);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload failed."); }
    finally { setUploading(false); }
  }
  function canDropImage(event: React.DragEvent) {
    const types = Array.from(event.dataTransfer.types);
    return types.includes("Files") || types.includes(comicLibraryDragType);
  }
  function dragOverImage(event: React.DragEvent<HTMLDivElement>) {
    if (!canDropImage(event)) return;
    event.preventDefault(); event.stopPropagation();
    event.dataTransfer.dropEffect = uploading ? "none" : "copy";
    if (!uploading) setFileOver(true);
  }
  function dragLeaveImage(event: React.DragEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX <= rect.left || event.clientX >= rect.right || event.clientY <= rect.top || event.clientY >= rect.bottom) setFileOver(false);
  }
  function dropImage(event: React.DragEvent<HTMLDivElement>) {
    if (!canDropImage(event)) return;
    event.preventDefault(); event.stopPropagation(); setFileOver(false);
    if (uploading) return;
    if (Array.from(event.dataTransfer.types).includes("Files")) {
      if (event.dataTransfer.files.length === 1) void uploadFile(event.dataTransfer.files[0]);
      else setError("Drop one image at a time.");
      return;
    }
    const src = event.dataTransfer.getData(comicLibraryDragType);
    if (library.includes(src)) void chooseImage(src);
  }
  function addBubble() {
    if (section.bubbles.length >= 30) return;
    const id = newId();
    const x = section.bubbles.length % 2 ? 300 : 95;
    onChange(next => {
      if (next.topSpace < 210) {
        next.topSpace = 210;
      }
      const y = Math.round(Math.max(18, next.topSpace * .14));
      const bubble: ComicBubble = { id, text: "YOUR DIALOGUE", x, y, width: 400, height: 155, tailSide: "bottom", tailX: clamp(x + 260, 0, 800), tailY: next.topSpace + 35, fontSize: 18 };
      next.bubbles.push(bubble); next.renderedSrc = undefined;
    });
    setSelected(id);
    requestAnimationFrame(() => inlineTextRef.current?.focus({ preventScroll: true }));
  }
  function addText(side: "above" | "below") {
    if (section.bubbles.length >= 30) return;
    const id = newId();
    const height = 140;
    const gap = 16;
    onChange(next => {
      if (side === "above") {
        const oldTop = next.topSpace;
        const addedSpace = Math.max(0, height + gap * 2 - oldTop);
        if (addedSpace) {
          next.topSpace += addedSpace;
          for (const bubble of next.bubbles) { bubble.y += addedSpace; bubble.tailY += addedSpace; }
          for (const sound of next.sounds) sound.y += addedSpace;
        }
      } else {
        next.bottomSpace = Math.max(next.bottomSpace, height + gap * 2);
      }
      const y = side === "above" ? next.topSpace - height - gap : next.topSpace + comicImageHeight(next) + gap;
      const width = 626;
      next.bubbles.push({ id, shape: "rectangle", text: "YOUR TEXT", x: (800 - width) / 2, y, width, height, tailSide: "none", tailX: 400, tailY: y + height / 2, fontSize: 18 });
      next.renderedSrc = undefined;
    });
    setSelected(id);
    requestAnimationFrame(() => inlineTextRef.current?.focus({ preventScroll: true }));
  }
  function removeBubble(id: string) {
    onChange(next => { next.bubbles = next.bubbles.filter(item => item.id !== id && item.parentId !== id); next.renderedSrc = undefined; });
    if (selected === id) setSelected(null);
  }
  function addSound() {
    if (section.sounds.length >= 30) return;
    const id = newId();
    onChange(next => {
      next.sounds.push({ id, text: "NEIGH", x: next.sounds.length % 2 ? 600 : 205, y: next.topSpace + 150, fontSize: 84, rotation: -18, color: "#171412", outlineEnabled: true, outlineColor: "#ffffff", outlineWidth: 4 });
      next.renderedSrc = undefined;
    });
    setSelected(id);
    requestAnimationFrame(() => inlineSoundRef.current?.focus({ preventScroll: true }));
  }
  function removeSound(id: string) {
    onChange(next => { next.sounds = next.sounds.filter(item => item.id !== id); next.renderedSrc = undefined; });
    if (selected === id) setSelected(null);
  }
  function duplicateSound(sound: ComicSound) {
    if (section.sounds.length >= 30) return;
    const id = newId();
    onChange(next => { next.sounds.push({ ...sound, id, x: clamp(sound.x + 32, 0, 800), y: clamp(sound.y + 32, 0, comicHeight(next)) }); next.renderedSrc = undefined; });
    setSelected(id);
  }
  function duplicateBubble(bubble: ComicBubble) {
    const members = bubbleMembers(section.bubbles, bubble);
    if (section.bubbles.length + members.length > 30) return;
    const id = newId();
    onChange(next => {
      const totalHeight = comicHeight(next);
      const dx = bubble.x + bubble.width + 28 <= 800 ? 28 : -28;
      const dy = bubble.y + bubble.height + 28 <= totalHeight ? 28 : -28;
      const copies = members.map((item, index) => ({ ...item, id: index === 0 ? id : newId(), ...(index > 0 ? { parentId: id } : {}), x: clamp(item.x + dx, 0, 800 - item.width), y: clamp(item.y + dy, 0, totalHeight - item.height), tailX: clamp(item.tailX + dx, 0, 800), tailY: clamp(item.tailY + dy, 0, totalHeight) }));
      for (const copy of copies) constrainTail(copy, totalHeight);
      next.bubbles.push(...copies);
      next.renderedSrc = undefined;
    });
    setSelected(id);
  }
  function addConnectedBubble(bubble: ComicBubble) {
    if (section.bubbles.length >= 30) return;
    const root = bubble.parentId ? section.bubbles.find(item => item.id === bubble.parentId) : bubble;
    if (!root || root.shape === "rectangle") return;
    const id = newId();
    onChange(next => {
      const width = Math.min(320, root.width);
      const height = 145;
      const siblings = next.bubbles.filter(item => item.parentId === root.id).length;
      const x = clamp(root.x + root.width * .44 + siblings * 22, 0, 800 - width);
      const below = root.y + root.height + height * .7 <= comicHeight(next);
      const y = clamp(below ? root.y + root.height * .62 + siblings * 18 : root.y - height * .62 - siblings * 18, 0, comicHeight(next) - height);
      next.bubbles.push({ id, parentId: root.id, text: "MORE DIALOGUE", x: Math.round(x), y: Math.round(y), width, height, tailSide: "none", tailX: x + width / 2, tailY: y + height / 2, fontSize: 18 });
      next.renderedSrc = undefined;
    });
    setSelected(id);
    requestAnimationFrame(() => inlineTextRef.current?.focus({ preventScroll: true }));
  }
  function flipBubble(bubble: ComicBubble) {
    updateBubble(bubble.id, (item, next) => {
      const { deltaY, tailSide } = bubbleFlipPlacement(next, item);
      moveBubbleMembers(next, bubbleMembers(next.bubbles, item).map(member => ({ ...member })), 0, deltaY);
      if (item.tailSide === "left" || item.tailSide === "right" || item.tailSide === "none") item.tailX = clamp(item.x + item.width * .55, 0, 800);
      item.tailSide = tailSide;
      item.tailY = clamp(tailSide === "top" ? item.y - 55 : item.y + item.height + 55, 0, comicHeight(next));
      constrainTail(item, comicHeight(section));
    });
  }
  function moveLayer(id: string, direction: -1 | 1) {
    onChange(next => {
      const rootId = next.bubbles.find(item => item.id === id)?.parentId || id;
      const roots = next.bubbles.filter(item => !item.parentId);
      const index = roots.findIndex(item => item.id === rootId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= roots.length) return;
      [roots[index], roots[target]] = [roots[target], roots[index]];
      next.bubbles = roots.flatMap(root => [root, ...next.bubbles.filter(item => item.parentId === root.id)]);
      next.renderedSrc = undefined;
    });
  }
  function moveSoundLayer(id: string, direction: -1 | 1) {
    onChange(next => {
      const index = next.sounds.findIndex(item => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.sounds.length) return;
      [next.sounds[index], next.sounds[target]] = [next.sounds[target], next.sounds[index]];
      next.renderedSrc = undefined;
    });
  }
  function canvasPoint(event: React.PointerEvent<HTMLDivElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scale = 800 / rect.width;
    return { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale };
  }
  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as Element;
    const handle = target.closest<SVGElement>("[data-handle]")?.getAttribute("data-handle");
    const point = canvasPoint(event);
    const scale = 800 / canvasRef.current!.getBoundingClientRect().width;
    const bubbleId = target.closest<SVGElement>("[data-bubble-id]")?.getAttribute("data-bubble-id");
    const bubble = section.bubbles.find(item => item.id === bubbleId);
    if (bubble) {
      if (handle === "delete") { drag.current = null; removeBubble(bubble.id); event.preventDefault(); return; }
      if (handle === "duplicate") { drag.current = null; duplicateBubble(bubble); event.preventDefault(); return; }
      if (handle === "flip") { drag.current = null; flipBubble(bubble); event.preventDefault(); return; }
      drag.current = { kind: "bubble", id: bubble.id, mode: handle === "resize" || handle === "tail" ? handle : "move", startX: point.x, startY: point.y, clientX: event.clientX, clientY: event.clientY, scale, bubble: { ...bubble }, members: bubbleMembers(section.bubbles, bubble).map(item => ({ ...item })) };
      setSelected(bubble.id);
    } else {
      const soundId = target.closest<SVGElement>("[data-sound-id]")?.getAttribute("data-sound-id");
      const sound = section.sounds.find(item => item.id === soundId);
      if (!sound) { drag.current = null; setSelected(null); return; }
      if (handle === "delete") { removeSound(sound.id); event.preventDefault(); return; }
      drag.current = {
        kind: "sound", id: sound.id, mode: handle === "size" || handle === "rotate" ? handle : "move",
        startX: point.x, startY: point.y, clientX: event.clientX, clientY: event.clientY, scale,
        startDistance: Math.max(1, Math.hypot(point.x - sound.x, point.y - sound.y)),
        startAngle: Math.atan2(point.y - sound.y, point.x - sound.x) * 180 / Math.PI,
        sound: { ...sound },
      };
      setSelected(sound.id);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const start = drag.current;
    // Selecting an item inserts settings above the canvas. Screen deltas stay
    // stable even if the canvas moves or the browser adjusts scroll anchoring.
    const dx = (event.clientX - start.clientX) * start.scale;
    const dy = (event.clientY - start.clientY) * start.scale;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    const point = { x: start.startX + dx, y: start.startY + dy };
    if (start.kind === "bubble") updateBubble(start.id, (bubble, next) => {
      if (start.mode === "move") {
        moveBubbleMembers(next, start.members, dx, dy);
      } else if (start.mode === "resize") {
        bubble.width = Math.round(clamp(start.bubble.width + dx, 100, Math.min(bubble.shape === "rectangle" ? 800 : 760, 800 - bubble.x)));
        bubble.height = Math.round(clamp(start.bubble.height + dy, 70, Math.min(600, comicHeight(section) - bubble.y)));
      } else {
        bubble.tailX = Math.round(clamp(start.bubble.tailX + dx, 0, 800));
        bubble.tailY = Math.round(clamp(start.bubble.tailY + dy, 0, comicHeight(section)));
      }
      constrainTail(bubble, comicHeight(section));
    });
    else updateSound(start.id, sound => {
      if (start.mode === "move") {
        sound.x = Math.round(clamp(start.sound.x + dx, 0, 800));
        sound.y = Math.round(clamp(start.sound.y + dy, 0, comicHeight(section)));
      } else if (start.mode === "size") {
        const distance = Math.hypot(point.x - start.sound.x, point.y - start.sound.y);
        sound.fontSize = Math.round(clamp(start.sound.fontSize * distance / start.startDistance, 24, 180));
      } else {
        const angle = Math.atan2(point.y - start.sound.y, point.x - start.sound.x) * 180 / Math.PI;
        sound.rotation = Math.round(clamp(start.sound.rotation + angle - start.startAngle, -180, 180));
      }
    });
  }
  function pointerUp(event: React.PointerEvent<HTMLDivElement>) {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if ((!activeBubble && !activeSound) || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) || (event.target as Element).closest("input,textarea,select")) return;
    event.preventDefault();
    const amount = event.shiftKey ? 10 : 1;
    const dx = event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0;
    const dy = event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0;
    if (activeBubble) updateBubble(activeBubble.id, (bubble, next) => moveBubbleMembers(next, bubbleMembers(next.bubbles, bubble).map(item => ({ ...item })), dx, dy));
    else if (activeSound) updateSound(activeSound.id, sound => { sound.x = clamp(sound.x + dx, 0, 800); sound.y = clamp(sound.y + dy, 0, comicHeight(section)); });
  }

  const trashIcon = `<path d="M -6 -6 H 6 M -4 -3 V 6 M 0 -3 V 6 M 4 -3 V 6 M -7 -3 H 7 L 6 9 H -6 Z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>`;
  const bubbleOverlay = activeBubble ? `<g data-bubble-id="${escapeAttribute(activeBubble.id)}"><rect data-handle="move" x="${activeBubble.x - 32}" y="${activeBubble.y - 32}" width="${activeBubble.width + 64}" height="${activeBubble.height + 64}" fill="transparent" pointer-events="all"/><rect x="${activeBubble.x}" y="${activeBubble.y}" width="${activeBubble.width}" height="${activeBubble.height}" fill="transparent" stroke="#e8a650" stroke-width="2" stroke-dasharray="8 6" pointer-events="all"/><rect data-handle="resize" x="${activeBubble.x + activeBubble.width - 12}" y="${activeBubble.y + activeBubble.height - 12}" width="24" height="24" rx="3" fill="#e8a650" stroke="#171412" stroke-width="2"/>${activeBubble.tailSide !== "none" ? `<circle data-handle="tail" cx="${activeBubble.tailX}" cy="${activeBubble.tailY}" r="13" fill="#e8a650" stroke="#171412" stroke-width="2"/>` : ""}</g>` : "";
  const soundSize = activeSound ? soundBounds(activeSound) : null;
  const soundOverlay = activeSound && soundSize ? `<g data-sound-id="${escapeAttribute(activeSound.id)}" transform="translate(${activeSound.x} ${activeSound.y}) rotate(${activeSound.rotation})"><rect x="${-soundSize.width / 2}" y="${-soundSize.height / 2}" width="${soundSize.width}" height="${soundSize.height}" fill="transparent" stroke="#e8a650" stroke-width="2" stroke-dasharray="8 6" pointer-events="all"/><rect data-handle="size" x="${soundSize.width / 2 - 11}" y="${soundSize.height / 2 - 11}" width="22" height="22" rx="3" fill="#e8a650" stroke="#171412" stroke-width="2"/><circle data-handle="rotate" cx="0" cy="${-soundSize.height / 2 - 24}" r="12" fill="#e8a650" stroke="#171412" stroke-width="2"/><g data-handle="delete" transform="translate(${soundSize.width / 2 - 16} ${-soundSize.height / 2 + 16})"><title>Delete sound effect</title><circle r="17" fill="#a84032" stroke="#fff" stroke-width="2"/>${trashIcon}</g></g>` : "";
  const overlay = bubbleOverlay + soundOverlay;
  const svg = renderComicSvg(section, section.src, undefined, activeBubble?.id).replace("</svg>", `${overlay}</svg>`);

  return <div className="comic-editor">
    <div className="comic-settings">
      <Slider label="Space above" value={section.topSpace} min={minimumComicSpace(section, "above")} max={1600} dragOnly onChange={value => onChange(next => updateComicSpace(next, "above", value))} />
      <Slider label="Space below" value={section.bottomSpace} min={minimumComicSpace(section, "below")} max={1600} dragOnly onChange={value => onChange(next => updateComicSpace(next, "below", value))} />
      <label className="comic-aspect-select">Image format <select aria-label="Comic image format" value={section.aspect || "original"} onChange={event => onChange(next => { next.aspect = event.target.value as "16:9" | "9:16"; fitComicContent(next); next.renderedSrc = undefined; })}>{!section.aspect && <option value="original">Original image</option>}<option value="16:9">16:9 · Wide</option><option value="9:16">9:16 · Tall</option></select></label>
      <label className="comic-background-color">Background <input type="color" value={section.background} onChange={event => onChange(next => { next.background = event.target.value; next.renderedSrc = undefined; })} /></label>
    </div>
    {picker && <StoryboardLibraryDialog title={section.src ? "Replace comic image" : "Choose comic image"} onClose={() => setPicker(false)}><div className="comic-picker"><StoryboardLibraryUpload chapters={libraryChapters} defaultChapter={defaultChapter} onChapterCreated={onChapterCreated} onUploaded={src => { onUploaded(src); setChapter(libraryChapter(src)); setQuery(""); setLimit(24); }} /><div className="comic-picker-filters"><select aria-label="Filter comic images by chapter" value={chapter} onChange={event => { setChapter(event.target.value); setLimit(24); }}><option value="">All chapters</option>{chapters.map(name => <option key={name} value={name}>{name}</option>)}</select><input aria-label="Search comic image library" placeholder="Search images…" value={query} onChange={event => { setQuery(event.target.value); setLimit(24); }} /></div><p>{matches.length} images</p><div className="comic-picker-grid">{matches.slice(0, limit).map(src => <button key={src} type="button" title={decodeURIComponent(src)} draggable onDragStart={event => { event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData(comicLibraryDragType, src); }} onDragEnd={() => setFileOver(false)} onClick={() => void chooseImage(src)}><span><Image src={src} alt="" fill unoptimized sizes="110px" draggable={false} /></span><small>{decodeURIComponent(src.split("/").at(-1) || src).replace(/^[0-9]+-[0-9a-f-]{36}-/, "")}</small></button>)}</div>{matches.length > limit && <button type="button" onClick={() => setLimit(value => value + 24)}>Show more</button>}</div></StoryboardLibraryDialog>}
    {error && <p className="comic-error" role="alert">{error}</p>}
    {(section.bubbles.length > 0 || section.sounds.length > 0) && <div className="comic-inspector-slot">
    {!activeBubble && !activeSound && <div className="comic-inspector comic-inspector-empty"><p>Select a bubble, text panel or sound effect on the image to edit it.</p></div>}
    {activeBubble && <div className="comic-inspector" key={activeBubble.id}>
      <div className="comic-inspector-title"><strong>{activeBubble.shape === "rectangle" ? "Selected text" : activeBubble.parentId ? "Connected bubble" : activeCompanions.length ? "Main bubble" : "Selected bubble"}</strong><button type="button" title="Send backward" aria-label="Send backward" disabled={section.bubbles.filter(item => !item.parentId)[0]?.id === activeRoot?.id} onClick={() => moveLayer(activeBubble.id, -1)}>↓</button><button type="button" title="Bring forward" aria-label="Bring forward" disabled={section.bubbles.filter(item => !item.parentId).at(-1)?.id === activeRoot?.id} onClick={() => moveLayer(activeBubble.id, 1)}>↑</button></div>
      {activeBubble.shape !== "rectangle" && <div className="comic-connected-navigation"><button type="button" aria-label="Select main bubble" aria-pressed={!activeBubble.parentId} onClick={() => setSelected(activeRoot?.id || activeBubble.id)}>Main</button>{activeCompanions.map((item, index) => <button key={item.id} type="button" aria-label={`Select connected bubble ${index + 1}`} aria-pressed={activeBubble.id === item.id} onClick={() => setSelected(item.id)}>Bubble {index + 2}</button>)}<button type="button" onClick={() => addConnectedBubble(activeBubble)} disabled={section.bubbles.length >= 30}>+ Connected bubble</button></div>}
      {!activeTextLayout?.fits && <p className="comic-error" role="status">The text does not fit. Enlarge the {activeBubble.shape === "rectangle" ? "panel" : "bubble"} or shorten the text.</p>}
      <div className="comic-control-grid">
        {activeBubble.shape !== "rectangle" && !activeBubble.parentId && <label>Tail <select aria-label="Bubble tail side" value={activeBubble.tailSide} onChange={event => updateBubble(activeBubble.id, bubble => { bubble.tailSide = event.target.value as ComicBubble["tailSide"]; aimTail(bubble, comicHeight(section)); })}><option value="none">None</option><option value="top">Top</option><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option></select></label>}
        <Slider label="Text size" value={activeBubble.fontSize} min={18} max={64} onChange={value => updateBubble(activeBubble.id, bubble => { bubble.fontSize = value; })} />
        <Slider label={activeCompanions.length && !activeBubble.parentId ? "Group horizontal position" : "Horizontal position"} value={activeBubble.x} min={activeMoveMinX} max={activeMoveMaxX} dragOnly onChange={value => updateBubble(activeBubble.id, (bubble, next) => moveBubbleMembers(next, bubbleMembers(next.bubbles, bubble).map(item => ({ ...item })), value - bubble.x, 0))} />
        <Slider label={activeCompanions.length && !activeBubble.parentId ? "Group vertical position" : "Vertical position"} value={activeBubble.y} min={activeMoveMinY} max={activeMoveMaxY} dragOnly onChange={value => updateBubble(activeBubble.id, (bubble, next) => moveBubbleMembers(next, bubbleMembers(next.bubbles, bubble).map(item => ({ ...item })), 0, value - bubble.y))} />
        <Slider label="Width" value={activeBubble.width} min={100} max={activeBubbleMaxWidth} onChange={value => updateBubble(activeBubble.id, bubble => { if (bubble.shape === "rectangle") { const center = bubble.x + bubble.width / 2; bubble.width = value; bubble.x = clamp(center - value / 2, 0, 800 - value); } else bubble.width = value; constrainTail(bubble, comicHeight(section)); })} />
        <div className="comic-height-control"><Slider label="Height" value={activeBubble.height} min={70} max={Math.min(600, comicHeight(section) - activeBubble.y)} onChange={value => updateBubble(activeBubble.id, bubble => { bubble.height = value; constrainTail(bubble, comicHeight(section)); })} />{activeBubble.shape === "rectangle" && <><button type="button" title="Center text horizontally" aria-label="Center text horizontally" onClick={() => updateBubble(activeBubble.id, bubble => { bubble.x = (800 - bubble.width) / 2; })}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2 10h5m6 0h5M5 7l3 3-3 3m10-6-3 3 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></button><button type="button" title={verticalCenterTitle} aria-label="Center text vertically in its current space" disabled={!canCenterVertically} onClick={() => updateBubble(activeBubble.id, bubble => { const imageBottom = section.topSpace + comicImageHeight(section); bubble.y = activeBubbleZone === "above" ? Math.max(0, Math.round((section.topSpace - bubble.height) / 2)) : Math.round(imageBottom + (section.bottomSpace - bubble.height) / 2); })}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2v5m0 6v5M7 5l3 3 3-3m-6 10 3-3 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></button></>}</div>
      </div>
    </div>}
    {activeSound && <div className="comic-inspector" key={activeSound.id}>
      <div className="comic-inspector-title"><strong>Selected sound effect</strong><button type="button" title="Send sound effect backward" aria-label="Send sound effect backward" disabled={section.sounds[0]?.id === activeSound.id} onClick={() => moveSoundLayer(activeSound.id, -1)}>↓</button><button type="button" title="Bring sound effect forward" aria-label="Bring sound effect forward" disabled={section.sounds.at(-1)?.id === activeSound.id} onClick={() => moveSoundLayer(activeSound.id, 1)}>↑</button><button type="button" disabled={section.sounds.length >= 30} onClick={() => duplicateSound(activeSound)}>Duplicate</button><button type="button" onClick={() => removeSound(activeSound.id)}>Delete</button></div>
      <div className="comic-sound-controls">
        <div className="comic-control-grid comic-sound-control-grid">
          <Slider label="Text size" value={activeSound.fontSize} min={24} max={180} onChange={value => updateSound(activeSound.id, sound => { sound.fontSize = value; })} />
          <Slider label="Angle" value={activeSound.rotation} min={-180} max={180} unit="°" onChange={value => updateSound(activeSound.id, sound => { sound.rotation = value; })} />
          <Slider label="Horizontal position" value={activeSound.x} min={0} max={800} dragOnly onChange={value => updateSound(activeSound.id, sound => { sound.x = value; })} />
          <Slider label="Vertical position" value={activeSound.y} min={0} max={comicHeight(section)} dragOnly onChange={value => updateSound(activeSound.id, sound => { sound.y = value; })} />
        </div>
        <div className="comic-sound-appearance">
          <label className="comic-color-control">Text color <input aria-label="Sound text color" type="color" value={activeSound.color} onChange={event => updateSound(activeSound.id, sound => { sound.color = event.target.value; })} /></label>
          <label className="comic-outline-toggle"><span>Outline</span><input type="checkbox" aria-label="Sound outline enabled" checked={activeSound.outlineEnabled === true} onChange={event => updateSound(activeSound.id, sound => { sound.outlineEnabled = event.target.checked; })} /></label>
          <label className="comic-color-control">Outline color <input aria-label="Sound outline color" type="color" value={activeSound.outlineColor || "#ffffff"} disabled={!activeSound.outlineEnabled} onChange={event => updateSound(activeSound.id, sound => { sound.outlineColor = event.target.value; })} /></label>
          <Slider label="Outline width" value={activeSound.outlineWidth || 4} min={1} max={16} disabled={!activeSound.outlineEnabled} onChange={value => updateSound(activeSound.id, sound => { sound.outlineWidth = value; })} />
        </div>
      </div>
    </div>}
    </div>}
    <div className="comic-actions"><button type="button" disabled={section.bubbles.length >= 30} onClick={addBubble}>+ Bubble</button><button type="button" disabled={section.bubbles.length >= 30} onClick={() => addText("above")}>+ Text above</button><button type="button" disabled={section.bubbles.length >= 30} onClick={() => addText("below")}>+ Text below</button><button type="button" disabled={section.sounds.length >= 30} onClick={addSound}>+ Sound effect</button><button type="button" aria-pressed={mobile} onClick={() => setMobile(value => !value)}>{mobile ? "Desktop preview" : "Mobile preview"}</button></div>
    {!emptyImage && <div className="comic-source-row" aria-label="Image source"><button type="button" onClick={() => setPicker(value => !value)}>{section.src ? "Replace from library" : "Choose from library"}</button><label className="comic-upload">{uploading ? "Uploading…" : "Upload image"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploading} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void uploadFile(file); }} /></label></div>}
    <div className={`comic-stage-wrap${fileOver ? " is-file-over" : ""}${!section.src ? " is-empty" : ""}`} onDragEnter={dragOverImage} onDragOver={dragOverImage} onDragLeave={dragLeaveImage} onDrop={dropImage}>
      {emptyImage ? <div className="sb-image-placeholder sb-file-dropzone comic-empty-drop" role="group" aria-label="Comic image drop zone"><svg className="sb-drop-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 4v15m0 0-5-5m5 5 5-5M6 23v4h20v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg><p>{uploading ? "Uploading…" : fileOver ? "Release to add image" : "Drop image here"}</p><button type="button" onClick={() => setPicker(value => !value)}>Choose from image library</button><label className="sb-upload">Upload image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploading} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void uploadFile(file); }} /></label></div> :
      <div ref={canvasRef} className="comic-stage" style={{ maxWidth: mobile ? 312 : 480 }} role="group" tabIndex={0} aria-label="Comic composition canvas" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={keyDown}>
        <div dangerouslySetInnerHTML={{ __html: svg }} />
        {activeBubble && <div className="comic-bubble-tools" style={{ left: `${(activeBubble.x + activeBubble.width) / 8}%`, top: `${activeBubble.y / comicHeight(section) * 100}%` }} onPointerDown={event => event.stopPropagation()}>
          {activeBubble.shape !== "rectangle" && !activeBubble.parentId && <button type="button" title="Flip bubble above or below" aria-label="Flip bubble above or below" onClick={() => flipBubble(activeBubble)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 2v16m0 0-4-4m4 4 4-4M14 18V2m0 0-4 4m4-4 4 4" /></svg></button>}
          {activeBubble.shape !== "rectangle" && <button type="button" title="Add connected bubble" aria-label="Add connected bubble" disabled={section.bubbles.length >= 30} onClick={() => addConnectedBubble(activeBubble)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v14M3 10h14" /></svg></button>}
          <button type="button" title={`Duplicate ${activeBubble.shape === "rectangle" ? "text" : "bubble"}`} aria-label={`Duplicate ${activeBubble.shape === "rectangle" ? "text" : "bubble"}`} disabled={section.bubbles.length + bubbleMembers(section.bubbles, activeBubble).length > 30} onClick={() => duplicateBubble(activeBubble)}><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="6" width="10" height="11" rx="1"/><path d="M7 3h10v11" /></svg></button>
          <button type="button" title={`Delete ${activeBubble.shape === "rectangle" ? "text" : "bubble"}`} aria-label={`Delete ${activeBubble.shape === "rectangle" ? "text" : "bubble"}`} className="comic-bubble-tool-delete" onClick={() => removeBubble(activeBubble.id)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 3h4m-7 3 1 11h8l1-11M8 9v6m4-6v6" /></svg></button>
        </div>}
        {activeBubble && activeTextLayout && <textarea ref={inlineTextRef} className="comic-inline-text" aria-label={activeBubble.shape === "rectangle" ? "Edit text in panel" : "Edit dialogue in bubble"} value={activeBubble.text} maxLength={1500} style={{ left: `${(activeBubble.x + (activeBubble.shape === "rectangle" ? 28 : activeBubble.width * .14)) / 8}%`, top: `${(activeBubble.y + (activeBubble.shape === "rectangle" ? 16 : activeBubble.height * .16)) / comicHeight(section) * 100}%`, width: `${(activeBubble.shape === "rectangle" ? activeBubble.width - 56 : activeBubble.width * .72) / 8}%`, height: `${(activeBubble.shape === "rectangle" ? activeBubble.height - 32 : activeBubble.height * .68) / comicHeight(section) * 100}%`, fontSize: `${activeTextLayout.size / 8}cqw`, paddingTop: `${Math.max(0, activeBubble.height * .34 - activeTextLayout.lines.length * activeTextLayout.size * 1.08 / 2) / 8}cqw` }} onChange={event => updateBubble(activeBubble.id, bubble => { bubble.text = event.target.value; })} onPointerDown={event => event.stopPropagation()} />}
        {activeSound && soundSize && <textarea ref={inlineSoundRef} className="comic-inline-sound" aria-label="Edit sound effect on image" value={activeSound.text} maxLength={100} style={{ left: `${activeSound.x / 8}%`, top: `${activeSound.y / comicHeight(section) * 100}%`, width: `${Math.max(80, soundSize.width - 48) / 8}%`, height: `${Math.max(activeSound.fontSize, soundSize.height - 30) / comicHeight(section) * 100}%`, fontSize: `${activeSound.fontSize / 8}cqw`, transform: `translate(-50%, -50%) rotate(${activeSound.rotation}deg)` }} onChange={event => updateSound(activeSound.id, sound => { sound.text = event.target.value; })} onPointerDown={event => event.stopPropagation()} />}
      </div>}
    </div>
  </div>;
}
