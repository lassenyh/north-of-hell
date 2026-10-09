import { parse } from "opentype.js";
import { jackArmstrongFontBase64 } from "./jack-armstrong-font";
import type { ComicTextPath } from "./comic-svg";

// SVG fonts are not reliably loaded by the image renderer in Vercel's Linux
// runtime. Turn the supplied lettering font into paths before rasterization.
const bytes = Buffer.from(jackArmstrongFontBase64, "base64");
const font = parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

function coordinate(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) throw new Error("Comic font contains an invalid point.");
  return Number(value.toFixed(2));
}

// opentype.js can emit NaN from Path.toPathData() for this font even when every
// path command is finite (for example the E in “BEER!”). Serialize the commands
// directly so a single bad SVG number cannot erase the rest of a word.
function pathData(commands: ReturnType<typeof font.getPath>["commands"]) {
  return commands.map(command => {
    switch (command.type) {
      case "M": case "L": return `${command.type}${coordinate(command.x)} ${coordinate(command.y)}`;
      case "Q": return `Q${coordinate(command.x1)} ${coordinate(command.y1)} ${coordinate(command.x)} ${coordinate(command.y)}`;
      case "C": return `C${coordinate(command.x1)} ${coordinate(command.y1)} ${coordinate(command.x2)} ${coordinate(command.y2)} ${coordinate(command.x)} ${coordinate(command.y)}`;
      case "Z": return "Z";
      default: throw new Error("Unsupported comic font path command.");
    }
  }).join("");
}

export const comicTextPath: ComicTextPath = (text, centerX, baselineY, size) => {
  const left = centerX - font.getAdvanceWidth(text, size) / 2;
  return pathData(font.getPath(text, left, baselineY, size).commands);
};
