import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import type { ComicSection } from "./model";
import { comicHeight, renderComicSvg } from "./comic-svg";
import { localStoryboardUpload, storyboardLocalMode } from "./mode";
import { jackArmstrongFontBase64 } from "./jack-armstrong-font";

async function sourceBytes(src: string) {
  if (src.startsWith("/")) {
    const root = resolve(process.cwd(), "public");
    const target = resolve(root, decodeURIComponent(src.slice(1)));
    if (!target.startsWith(root + sep)) throw new Error("Invalid comic image path.");
    try { return await readFile(target); }
    catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
      // Public files may be served by the CDN rather than bundled in a Vercel
      // Function. The production domain is public even when generated URLs are
      // protected, so it is the preferred fallback for unchanged local art.
      const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
      if (!host || !/^[a-z0-9.-]+$/i.test(host)) throw new Error("Comic source image is missing from the server.");
      return fetchImageBytes(new URL(src, `https://${host}`).toString());
    }
  }
  return fetchImageBytes(src);
}

async function fetchImageBytes(src: string) {
  const response = await fetch(src, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Comic image could not be loaded (${response.status}).`);
  const length = Number(response.headers.get("content-length") || 0);
  if (length > 25 * 1024 * 1024) throw new Error("Comic image is too large to publish.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 25 * 1024 * 1024) throw new Error("Comic image is too large to publish.");
  return bytes;
}

export async function publishComicImage(section: ComicSection) {
  if (!section.src) throw new Error(`Add an image to “${section.title}” before publishing.`);
  const original = await sourceBytes(section.src);
  const info = await sharp(original).metadata();
  if (!info.width || !info.height) throw new Error(`Could not read the dimensions of “${section.title}”.`);
  const measured = { ...section, imageWidth: info.width, imageHeight: info.height };
  if (comicHeight(measured) > 8000) throw new Error(`“${section.title}” is too tall to publish as one image. Split it into two comic sections.`);
  const image = await sharp(original).resize({ width: 1600, withoutEnlargement: true }).png().toBuffer();
  const svg = renderComicSvg(measured, `data:image/png;base64,${image.toString("base64")}`, jackArmstrongFontBase64);
  const output = await sharp(Buffer.from(svg), { density: 144 }).webp({ quality: 88, effort: 5 }).toBuffer();
  if (output.length > 10 * 1024 * 1024) throw new Error(`“${section.title}” exceeds the 10 MB published image limit.`);
  const filename = `comic-${crypto.randomUUID()}.webp`;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.STORYBOARD_SUPABASE_SERVER_KEY;
  if (!storyboardLocalMode && url && key) {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await client.storage.from("storyboard-images").upload(filename, output, { contentType: "image/webp", upsert: false });
    if (error) throw new Error(`Could not upload “${section.title}”: ${error.message}`);
    return { src: client.storage.from("storyboard-images").getPublicUrl(filename).data.publicUrl, imageWidth: info.width, imageHeight: info.height };
  }
  if (process.env.NODE_ENV === "production") throw new Error("Comic image storage is not configured.");
  const target = localStoryboardUpload(filename);
  await mkdir(target.directory, { recursive: true });
  await writeFile(join(target.directory, filename), output);
  return { src: target.src, imageWidth: info.width, imageHeight: info.height };
}
