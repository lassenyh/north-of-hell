import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStoryboardEditor } from "@/lib/storyboard/server";
import { localStoryboardUpload, storyboardLocalMode } from "@/lib/storyboard/mode";

const videoTypes = new Map([["video/mp4", "mp4"], ["video/webm", "webm"]]);
const maxVideoBytes = 50 * 1024 * 1024;
const bucket = "storyboard-videos";

function validVideo(type: unknown, size: unknown) {
  return typeof type === "string" && videoTypes.has(type) && typeof size === "number" && Number.isInteger(size) && size > 0 && size <= maxVideoBytes;
}

export async function POST(request: Request) {
  try {
    await requireStoryboardEditor();
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      if (!storyboardLocalMode) return NextResponse.json({ error: "Direct video upload is only available in local review mode." }, { status: 400 });
      const form = await request.formData();
      const file = form.get("video");
      if (!(file instanceof File) || !validVideo(file.type, file.size)) return NextResponse.json({ error: "Choose an MP4 or WebM video under 50 MB." }, { status: 400 });
      const name = `${crypto.randomUUID()}.${videoTypes.get(file.type)}`;
      const target = localStoryboardUpload(name);
      await mkdir(target.directory, { recursive: true });
      await writeFile(join(target.directory, name), new Uint8Array(await file.arrayBuffer()));
      return NextResponse.json({ src: target.src });
    }

    const { type, size } = await request.json();
    if (!validVideo(type, size)) return NextResponse.json({ error: "Choose an MP4 or WebM video under 50 MB." }, { status: 400 });
    if (storyboardLocalMode) return NextResponse.json({ mode: "local" });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.STORYBOARD_SUPABASE_SERVER_KEY;
    if (!url || !key) throw new Error("Video storage is not configured on the server.");
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const path = `${crypto.randomUUID()}.${videoTypes.get(type)}`;
    const storage = client.storage.from(bucket);
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message || "Could not prepare video upload.");
    return NextResponse.json({ mode: "signed", path, token: data.token, src: storage.getPublicUrl(path).data.publicUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Video upload failed." }, { status: 500 });
  }
}
