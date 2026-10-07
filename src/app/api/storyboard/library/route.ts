import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { loadStoryboardState, requireStoryboardEditor } from "@/lib/storyboard/server";
import { hiddenLibraryPath, libraryChapterKey, libraryMarkerPng, listStoryboardLibraryData } from "@/lib/storyboard/library";
import { localStoryboardUpload, storyboardLocalMode } from "@/lib/storyboard/mode";

const extensions = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["image/gif", "gif"]]);

export async function GET() {
  try { await requireStoryboardEditor(); return NextResponse.json(await listStoryboardLibraryData()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load library." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    await requireStoryboardEditor();
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json();
      const chapter = typeof body?.chapter === "string" ? body.chapter.trim() : "";
      if (!chapter || chapter.length > 120 || /[\x00-\x1f\x7f]/.test(chapter)) return NextResponse.json({ error: "Choose a chapter name (up to 120 characters)." }, { status: 400 });
      const { chapters } = await listStoryboardLibraryData();
      if (chapters.includes(chapter)) return NextResponse.json({ error: "This chapter already exists." }, { status: 409 });
      const path = `library/${libraryChapterKey(chapter)}/__chapter_marker__.png`;
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.STORYBOARD_SUPABASE_SERVER_KEY;
      if (!storyboardLocalMode && url && key) {
        const storage = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from("storyboard-images");
        // The bucket accepts images only; the marker is omitted from library results.
        const { error } = await storage.upload(path, libraryMarkerPng, { contentType: "image/png", upsert: false });
        if (error) throw new Error(error.message);
      } else {
        if (process.env.NODE_ENV === "production") throw new Error("Image library storage is not configured on the server.");
        const target = localStoryboardUpload(path);
        const destination = join(target.directory, path);
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, libraryMarkerPng, { flag: "wx" });
      }
      return NextResponse.json({ chapter });
    }
    const form = await request.formData();
    const chapter = String(form.get("chapter") || "").trim();
    const file = form.get("image");
    if (!chapter || chapter.length > 120 || /[\x00-\x1f\x7f]/.test(chapter)) return NextResponse.json({ error: "Choose a chapter name (up to 120 characters)." }, { status: 400 });
    if (!(file instanceof File) || !extensions.has(file.type) || !file.size || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Choose a JPG, PNG, WebP or GIF under 10 MB." }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const metadata = await sharp(bytes, { animated: true }).metadata().catch(() => null);
    const expected = file.type === "image/jpeg" ? "jpeg" : file.type.slice(6);
    if (metadata?.format !== expected || !metadata?.width || !metadata?.height) return NextResponse.json({ error: "The file is not a valid image of the selected type." }, { status: 400 });
    const basename = file.name.replace(/\.[^.]+$/, "").normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "frame";
    const path = `library/${libraryChapterKey(chapter)}/${Date.now()}-${crypto.randomUUID()}-${basename}.${extensions.get(file.type)}`;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.STORYBOARD_SUPABASE_SERVER_KEY;
    if (!storyboardLocalMode && url && key) {
      const storage = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from("storyboard-images");
      const { error } = await storage.upload(path, bytes, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      return NextResponse.json({ src: storage.getPublicUrl(path).data.publicUrl, chapter });
    }
    if (process.env.NODE_ENV === "production") throw new Error("Image uploads are not configured on the server.");
    const target = localStoryboardUpload(path);
    const destination = join(target.directory, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
    return NextResponse.json({ src: target.src, chapter });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireStoryboardEditor();
    const body = await request.json();
    const src = typeof body?.src === "string" ? body.src : "";
    const { library } = await listStoryboardLibraryData();
    if (!src || !library.includes(src)) return NextResponse.json({ error: "Image not found in the library." }, { status: 404 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.STORYBOARD_SUPABASE_SERVER_KEY;
    if (src.startsWith("/storyboard/")) {
      const path = hiddenLibraryPath(src);
      if (!storyboardLocalMode && url && key) {
        const storage = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from("storyboard-images");
        const { error } = await storage.upload(path, libraryMarkerPng, { contentType: "image/png", upsert: false });
        if (error) throw new Error(error.message);
      } else {
        if (process.env.NODE_ENV === "production") throw new Error("Image library storage is not configured on the server.");
        const target = localStoryboardUpload(path);
        await mkdir(dirname(join(target.directory, path)), { recursive: true });
        await writeFile(join(target.directory, path), libraryMarkerPng, { flag: "wx" });
      }
      return NextResponse.json({ hidden: src });
    }
    const state = await loadStoryboardState();
    for (const doc of [state.draft, state.published]) {
      if (doc?.chapters.some(chapter => chapter.sections.some(section => section.kind === "images"
        ? section.images.some(image => image.src === src)
        : section.kind === "comic" && section.src === src))) {
        return NextResponse.json({ error: "This image is used in the draft or published storyboard. Remove or replace it there first." }, { status: 409 });
      }
    }
    if (!storyboardLocalMode && url && key) {
      const storage = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from("storyboard-images");
      const prefix = storage.getPublicUrl("library/").data.publicUrl;
      if (!src.startsWith(prefix)) return NextResponse.json({ error: "Bundled frames cannot be deleted from the library." }, { status: 400 });
      const path = `library/${src.slice(prefix.length)}`;
      if (!/^library\/[A-Za-z0-9_-]+\/[^/]+\.(?:png|jpe?g|webp|gif)$/i.test(path)) return NextResponse.json({ error: "Invalid image path." }, { status: 400 });
      const { error } = await storage.remove([path]);
      if (error) throw new Error(error.message);
    } else {
      if (process.env.NODE_ENV === "production") throw new Error("Image library storage is not configured on the server.");
      const prefix = localStoryboardUpload("library/").src;
      if (!src.startsWith(prefix)) return NextResponse.json({ error: "Bundled frames cannot be deleted from the library." }, { status: 400 });
      const path = `library/${src.slice(prefix.length)}`;
      if (!/^library\/[A-Za-z0-9_-]+\/[^/]+\.(?:png|jpe?g|webp|gif)$/i.test(path)) return NextResponse.json({ error: "Invalid image path." }, { status: 400 });
      await unlink(join(localStoryboardUpload(path).directory, path));
    }
    return NextResponse.json({ deleted: src });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireStoryboardEditor();
    const body = await request.json();
    const src = typeof body?.src === "string" ? body.src : "";
    const { hidden } = await listStoryboardLibraryData();
    if (!hidden.includes(src)) return NextResponse.json({ error: "Hidden image not found." }, { status: 404 });
    const path = hiddenLibraryPath(src);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.STORYBOARD_SUPABASE_SERVER_KEY;
    if (!storyboardLocalMode && url && key) {
      const storage = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from("storyboard-images");
      const { error } = await storage.remove([path]);
      if (error) throw new Error(error.message);
    } else {
      if (process.env.NODE_ENV === "production") throw new Error("Image library storage is not configured on the server.");
      await unlink(join(localStoryboardUpload(path).directory, path));
    }
    return NextResponse.json({ restored: src });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Restore failed." }, { status: 500 });
  }
}
