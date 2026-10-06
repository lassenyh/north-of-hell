import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStoryboardEditor } from "@/lib/storyboard/server";

const allowed = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["image/gif", "gif"]]);
export async function POST(request: Request) {
  try {
    await requireStoryboardEditor();
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || !allowed.has(file.type) || file.size > 10 * 1024 * 1024 || file.size === 0)
      return NextResponse.json({ error: "Choose a JPG, PNG, WebP or GIF under 10 MB." }, { status: 400 });
    const name = `${crypto.randomUUID()}.${allowed.get(file.type)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.STORYBOARD_SUPABASE_SERVER_KEY;
    if (url && key) {
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error } = await client.storage.from("storyboard-images").upload(name, bytes, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      return NextResponse.json({ src: client.storage.from("storyboard-images").getPublicUrl(name).data.publicUrl });
    }
    if (process.env.NODE_ENV === "production") throw new Error("Image uploads are not configured on the server.");
    const directory = join(process.cwd(), "public", "storyboard-uploads");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, name), bytes);
    return NextResponse.json({ src: `/storyboard-uploads/${name}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 500 });
  }
}
