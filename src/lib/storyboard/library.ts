import { readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getComicFrames } from "@/lib/comic-frames";
import { libraryChapter } from "./library-chapter";
import { localStoryboardUpload, storyboardLocalMode } from "./mode";

const imageExtension = /\.(png|jpe?g|webp|gif)$/i;
const bucket = "storyboard-images";
export const libraryMarkerPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6n8AAAAASUVORK5CYII=", "base64");

export function hiddenLibraryPath(src: string) {
  return `library-hidden/${createHash("sha256").update(src).digest("hex")}.png`;
}

export function libraryChapterKey(chapter: string) {
  return Buffer.from(chapter, "utf8").toString("base64url");
}

export async function listStoryboardLibraryData(): Promise<{ library: string[]; chapters: string[]; hidden: string[] }> {
  const bundled = getComicFrames([]).map(frame => frame.src);
  const chapters = new Set(bundled.map(libraryChapter));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.STORYBOARD_SUPABASE_SERVER_KEY;
  if (!storyboardLocalMode && url && key) {
    const storage = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(bucket);
    const hiddenNames = new Set<string>();
    for (let offset = 0; ; offset += 1000) {
      const { data: markers, error: hiddenError } = await storage.list("library-hidden", { limit: 1000, offset });
      if (hiddenError) throw new Error(hiddenError.message);
      for (const marker of markers || []) if (marker.id) hiddenNames.add(marker.name);
      if (!markers || markers.length < 1000) break;
    }
    const hidden = bundled.filter(src => hiddenNames.has(hiddenLibraryPath(src).slice("library-hidden/".length)));
    const visibleBundled = bundled.filter(src => !hiddenNames.has(hiddenLibraryPath(src).slice("library-hidden/".length)));
    const { data: folders, error } = await storage.list("library", { limit: 1000 });
    if (error) throw new Error(error.message);
    const uploaded = await Promise.all((folders || []).filter(folder => !folder.id).map(async folder => {
      try { chapters.add(Buffer.from(folder.name, "base64url").toString("utf8")); } catch { /* Ignore invalid folder names. */ }
      const result: string[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data: files, error: listError } = await storage.list(`library/${folder.name}`, { limit: 1000, offset });
        if (listError) throw new Error(listError.message);
        result.push(...(files || []).filter(file => file.id && file.name !== "__chapter_marker__.png" && imageExtension.test(file.name)).map(file => storage.getPublicUrl(`library/${folder.name}/${file.name}`).data.publicUrl));
        if (!files || files.length < 1000) break;
      }
      return result;
    }));
    return { library: [...visibleBundled, ...uploaded.flat()], chapters: [...chapters].filter(Boolean).sort(), hidden };
  }
  const root = join(localStoryboardUpload("library").directory, "library");
  const uploaded: string[] = [];
  const hiddenRoot = join(localStoryboardUpload("library-hidden").directory, "library-hidden");
  const hiddenNames = new Set<string>();
  try { for (const marker of await readdir(hiddenRoot)) hiddenNames.add(marker); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  try {
    for (const folder of await readdir(root, { withFileTypes: true })) {
      if (!folder.isDirectory() || !/^[A-Za-z0-9_-]+$/.test(folder.name)) continue;
      try { chapters.add(Buffer.from(folder.name, "base64url").toString("utf8")); } catch { /* Ignore invalid folder names. */ }
      for (const file of await readdir(`${root}/${folder.name}`, { withFileTypes: true })) {
        if (file.isFile() && file.name !== "__chapter_marker__.png" && imageExtension.test(file.name)) uploaded.push(localStoryboardUpload(`library/${folder.name}/${file.name}`).src);
      }
    }
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const hidden = bundled.filter(src => hiddenNames.has(hiddenLibraryPath(src).slice("library-hidden/".length)));
  const visibleBundled = bundled.filter(src => !hiddenNames.has(hiddenLibraryPath(src).slice("library-hidden/".length)));
  return { library: [...visibleBundled, ...uploaded.sort()], chapters: [...chapters].filter(Boolean).sort(), hidden };
}

export async function listStoryboardLibrary() {
  return (await listStoryboardLibraryData()).library;
}
