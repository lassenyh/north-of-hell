import type { ComicBubble, ComicSection, ComicSound } from "./model";

export const COMIC_WIDTH = 800;
export const COMIC_RENDER_VERSION = 3;

export function comicImageHeight(section: ComicSection) {
  if (section.aspect === "16:9") return Math.round(COMIC_WIDTH * 9 / 16);
  if (section.aspect === "9:16") return Math.round(COMIC_WIDTH * 16 / 9);
  return Math.round(COMIC_WIDTH * section.imageHeight / section.imageWidth);
}

export function comicHeight(section: ComicSection) {
  return section.topSpace + comicImageHeight(section) + section.bottomSpace;
}

function xml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Normalized advance widths measured from the supplied font at 100 px.
const glyphWidths: Record<string, number> = {
  A:.716,B:.836,C:.851,D:.811,E:.758,F:.728,G:.928,H:.841,I:.704,J:.78,K:.752,L:.642,M:1.057,
  N:.792,O:.736,P:.814,Q:.781,R:.829,S:.797,T:.641,U:.811,V:.743,W:1.013,X:.745,Y:.779,Z:.777,
  " ":.391,".":.357,",":.441,"!":.34,"?":.856,"'":.392,"-":.689,":":.34,"&":.902,
  "0":.838,"1":.316,"2":.823,"3":.814,"4":.87,"5":.712,"6":.865,"7":.688,"8":.781,"9":.813,
};
function measuredLength(text: string, size: number) {
  return [...text.toUpperCase()].reduce((sum, char) => sum + (glyphWidths[char] ?? .85), 0) * size * 1.03;
}

function wrapAt(text: string, maxWidth: number, size: number) {
  const lines: string[] = [];
  for (const paragraph of text.trim().toUpperCase().split(/\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measuredLength(candidate, size) > maxWidth) { lines.push(line); line = word; }
      else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}

export function layoutBubbleText(bubble: ComicBubble) {
  const maxWidth = bubble.width * .72;
  const maxHeight = bubble.height * .68;
  for (let size = bubble.fontSize; size >= 18; size -= 1) {
    const lines = wrapAt(bubble.text, maxWidth, size);
    if (lines.length * size * 1.08 <= maxHeight && lines.every(line => measuredLength(line, size) <= maxWidth))
      return { lines, size, fits: true };
  }
  return { lines: wrapAt(bubble.text, maxWidth, 18), size: 18, fits: false };
}

type Point = { x: number; y: number };
type Curve = [Point, Point, Point, Point];
const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const coord = (p: Point) => `${Number(p.x.toFixed(2))} ${Number(p.y.toFixed(2))}`;
const curveCommand = (curve: Curve) => `C ${coord(curve[1])} ${coord(curve[2])} ${coord(curve[3])}`;
function splitCurve([p0, p1, p2, p3]: Curve, t: number): [Curve, Curve] {
  const a = mix(p0, p1, t); const b = mix(p1, p2, t); const c = mix(p2, p3, t);
  const d = mix(a, b, t); const e = mix(b, c, t); const center = mix(d, e, t);
  return [[p0, a, d, center], [center, e, c, p3]];
}

function bubbleOutline(b: ComicBubble) {
  const { x, y, width: w, height: h } = b;
  let hash = 0;
  for (const char of b.id) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  const wobble = ((hash >>> 0) % 11 - 5) / 500;
  const p = (px: number, py: number): Point => ({ x: x + w * px, y: y + h * py });
  const start = p(.12, .17 + wobble);
  const curves: { side: ComicBubble["tailSide"]; path: Curve }[] = [
    { side: "top", path: [start, p(.27, -.035 + wobble), p(.68, -.018 - wobble), p(.84, .14 - wobble)] },
    { side: "right", path: [p(.84, .14 - wobble), p(1.035, .29 + wobble), p(1.01, .7 - wobble), p(.85, .85 + wobble)] },
    { side: "bottom", path: [p(.85, .85 + wobble), p(.7, 1.05 - wobble), p(.28, 1.017 + wobble), p(.13, .86 - wobble)] },
    { side: "left", path: [p(.13, .86 - wobble), p(-.03, .69 + wobble), p(-.018, .3 - wobble), start] },
  ];
  const commands = [`M ${coord(start)}`];
  const accents: string[] = [];
  for (const [index, { side, path }] of curves.entries()) {
    if (b.tailSide === side) {
      // Cut the original perimeter exactly at both tail roots. The straight edges
      // leave from those points, so no control point can hook past the join.
      const position = side === "top" ? (b.tailX - x) / w : side === "bottom" ? 1 - (b.tailX - x) / w : side === "right" ? (b.tailY - y) / h : 1 - (b.tailY - y) / h;
      const center = Math.max(.34, Math.min(.66, position));
      const firstT = center - .075; const lastT = center + .075;
      const [before, remaining] = splitCurve(path, firstT);
      const [, after] = splitCurve(remaining, (lastT - firstT) / (1 - firstT));
      commands.push(curveCommand(before), `L ${coord({ x: b.tailX, y: b.tailY })}`, `L ${coord(after[0])}`, curveCommand(after));
    } else {
      commands.push(curveCommand(path));
      if (index === 0 || index === 2) {
        const [, tail] = splitCurve(path, .2 + ((hash >>> (index + 1)) & 3) * .035);
        const [accent] = splitCurve(tail, .2);
        accents.push(`M ${coord(accent[0])} ${curveCommand(accent)}`);
      }
    }
  }
  return { path: `${commands.join(" ")} Z`, accents };
}

export function soundBounds(sound: ComicSound) {
  const lines = sound.text.trim().toUpperCase().split(/\n/);
  return { lines, width: Math.max(60, ...lines.map(line => measuredLength(line, sound.fontSize))), height: Math.max(sound.fontSize, lines.length * sound.fontSize * .94) };
}

export function minimumComicSpace(section: ComicSection, side: "above" | "below") {
  const bubbleBottom = section.bubbles.reduce((bottom, bubble) => Math.max(bottom, bubble.y + bubble.height * 1.05 + 3, bubble.tailSide === "none" ? 0 : bubble.tailY + 3), 0);
  const soundBottom = section.sounds.reduce((bottom, sound) => {
    const bounds = soundBounds(sound);
    const angle = sound.rotation * Math.PI / 180;
    const halfHeight = (Math.abs(Math.sin(angle)) * bounds.width + Math.abs(Math.cos(angle)) * bounds.height) / 2;
    return Math.max(bottom, sound.y + halfHeight + 3);
  }, 0);
  const otherSpace = side === "above" ? section.bottomSpace : section.topSpace;
  const currentSpace = side === "above" ? section.topSpace : section.bottomSpace;
  return Math.min(currentSpace, Math.max(0, Math.ceil(Math.max(bubbleBottom, soundBottom) - comicImageHeight(section) - otherSpace)));
}

export function fitComicContent(section: ComicSection) {
  const bubbleBottom = section.bubbles.reduce((bottom, bubble) => Math.max(bottom, bubble.y + bubble.height * 1.05 + 3, bubble.tailSide === "none" ? 0 : bubble.tailY + 3), 0);
  const soundBottom = section.sounds.reduce((bottom, sound) => {
    const bounds = soundBounds(sound);
    const angle = sound.rotation * Math.PI / 180;
    const halfHeight = (Math.abs(Math.sin(angle)) * bounds.width + Math.abs(Math.cos(angle)) * bounds.height) / 2;
    return Math.max(bottom, sound.y + halfHeight + 3);
  }, 0);
  section.bottomSpace = Math.min(1600, Math.max(section.bottomSpace, Math.ceil(Math.max(bubbleBottom, soundBottom) - section.topSpace - comicImageHeight(section))));
}

export function updateComicSpace(section: ComicSection, side: "above" | "below", value: number) {
  const next = Math.max(minimumComicSpace(section, side), Math.min(1600, Math.round(value)));
  if (side === "above") section.topSpace = next;
  else section.bottomSpace = next;
  section.renderedSrc = undefined;
}

export function renderComicSvg(section: ComicSection, imageHref = section.src, fontData?: string) {
  const height = comicHeight(section);
  const imageHeight = comicImageHeight(section);
  const embeddedFont = fontData ? `<style>@font-face{font-family:'Jack Armstrong';src:url(data:font/ttf;base64,${fontData}) format('truetype');font-weight:400}</style>` : "";
  const bubbles = section.bubbles.map(bubble => {
    const text = layoutBubbleText(bubble);
    const lineHeight = text.size * 1.08;
    const firstY = bubble.y + bubble.height * .5 - (text.lines.length - 1) * lineHeight / 2 + text.size * .34;
    const spans = text.lines.map((line, index) => `<tspan x="${bubble.x + bubble.width / 2}" y="${firstY + index * lineHeight}">${xml(line || " ")}</tspan>`).join("");
    const outline = bubbleOutline(bubble);
    const accents = outline.accents.map(path => `<path d="${path}" fill="none" stroke="#171412" stroke-width="4.8" stroke-linecap="round" opacity=".7"/>`).join("");
    return `<g data-bubble-id="${xml(bubble.id)}"><path d="${outline.path}" fill="#fff" stroke="#171412" stroke-width="3.4" stroke-linejoin="round"/>${accents}<text fill="#171412" font-family="Jack Armstrong, sans-serif" font-size="${text.size}" font-weight="400" text-anchor="middle">${spans}</text></g>`;
  }).join("");
  const sounds = section.sounds.map(sound => {
    const bounds = soundBounds(sound);
    const lineHeight = sound.fontSize * .94;
    const firstY = -(bounds.lines.length - 1) * lineHeight / 2 + sound.fontSize * .33;
    const spans = bounds.lines.map((line, index) => `<tspan x="0" y="${Number((firstY + index * lineHeight).toFixed(2))}">${xml(line || " ")}</tspan>`).join("");
    const outlined = sound.outlineEnabled === true;
    const outline = outlined ? ` stroke="${sound.outlineColor || "#ffffff"}" stroke-width="${sound.outlineWidth || 4}" stroke-linejoin="round" paint-order="stroke fill"` : "";
    return `<g data-sound-id="${xml(sound.id)}" transform="translate(${sound.x} ${sound.y}) rotate(${sound.rotation})"><rect x="${-bounds.width / 2}" y="${-bounds.height / 2}" width="${bounds.width}" height="${bounds.height}" fill="transparent" pointer-events="all"/><text fill="${sound.color}"${outline} font-family="Jack Armstrong, sans-serif" font-size="${sound.fontSize}" text-anchor="middle">${spans}</text></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${COMIC_WIDTH}" height="${height}" viewBox="0 0 ${COMIC_WIDTH} ${height}" role="img" aria-label="${xml(section.description || section.title)}">${embeddedFont}<rect width="800" height="${height}" fill="${section.background}"/>${imageHref ? `<image href="${xml(imageHref)}" x="0" y="${section.topSpace}" width="800" height="${imageHeight}" preserveAspectRatio="${section.aspect ? "xMidYMid slice" : "none"}"/>` : ""}${bubbles}${sounds}</svg>`;
}
