import { parse } from "opentype.js";
import { jackArmstrongFontBase64 } from "./jack-armstrong-font";
import type { ComicTextPath } from "./comic-svg";

// SVG fonts are not reliably loaded by the image renderer in Vercel's Linux
// runtime. Turn the supplied lettering font into paths before rasterization.
const bytes = Buffer.from(jackArmstrongFontBase64, "base64");
const font = parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

export const comicTextPath: ComicTextPath = (text, centerX, baselineY, size) => {
  const left = centerX - font.getAdvanceWidth(text, size) / 2;
  return font.getPath(text, left, baselineY, size).toPathData(2);
};
