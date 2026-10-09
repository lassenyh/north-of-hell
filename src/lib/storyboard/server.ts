import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getAdminLoginById } from "@/lib/supabase/admin-auth";
import { getStoryboardFrames, PROJECT_SLUG, type StoryboardFrame } from "@/lib/supabase/storyboard";
import { getComicFrames } from "@/lib/comic-frames";
import { emptyDocument, importLegacyFrames, parseDocument, type StoryboardDocument, type StoryboardState } from "./model";
import { publishComicImage } from "./comic-render";
import { COMIC_RENDER_VERSION, layoutBubbleText } from "./comic-svg";
import { storyboardLocalMode } from "./mode";

const localPath = storyboardLocalMode && process.env.STORYBOARD_LOCAL_STATE_PATH
  ? process.env.STORYBOARD_LOCAL_STATE_PATH : join(process.cwd(), ".local", "storyboard-state.json");

function database() {
  if (storyboardLocalMode) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.STORYBOARD_SUPABASE_SERVER_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } });
}

export async function requireStoryboardEditor() {
  if (storyboardLocalMode) return;
  const id = (await cookies()).get("noh_admin_auth")?.value;
  if (!id || !(await getAdminLoginById(id))) throw new Error("Sign in as an administrator to edit the storyboard.");
}

export async function legacyStoryboardDocument(): Promise<StoryboardDocument> {
  let frames: StoryboardFrame[] = [];
  try { frames = await getStoryboardFrames(); } catch { /* Local assets are still available. */ }
  if (!frames.length) {
    frames = getComicFrames([]).map((frame, index) => ({
      id: `local-${index}`, project_slug: PROJECT_SLUG, image_src: frame.src,
      frame_order: index, text: frame.manuscript, updated_at: "",
    }));
  }
  return frames.length ? importLegacyFrames(frames) : emptyDocument();
}

export async function loadStoryboardState(): Promise<StoryboardState> {
  const db = database();
  if (db) {
    const { data, error } = await db.from("storyboard_documents")
      .select("draft,published,draft_version,published_version,saved_at,published_at")
      .eq("project_slug", PROJECT_SLUG).maybeSingle();
    if (error) throw new Error(`Could not load storyboard: ${error.message}`);
    if (data) return {
      draft: parseDocument(data.draft), published: data.published ? parseDocument(data.published) : null,
      draftVersion: Number(data.draft_version), publishedVersion: data.published_version == null ? null : Number(data.published_version),
      savedAt: data.saved_at, publishedAt: data.published_at,
    };
  } else if (process.env.NODE_ENV === "production") {
    // Keep the old public page readable until server-side storage has been configured.
    const initial = await legacyStoryboardDocument();
    return { draft: initial, published: initial, draftVersion: 0, publishedVersion: 0, savedAt: null, publishedAt: null };
  } else {
    try {
      const state = JSON.parse(await readFile(localPath, "utf8")) as StoryboardState;
      return { ...state, draft: parseDocument(state.draft), published: state.published ? parseDocument(state.published) : null };
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code !== "ENOENT") throw error;
    }
  }
  return { draft: await legacyStoryboardDocument(), published: null, draftVersion: 0, publishedVersion: null, savedAt: null, publishedAt: null };
}

async function writeLocal(state: StoryboardState) {
  await mkdir(dirname(localPath), { recursive: true });
  const temporary = `${localPath}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(state));
  await rename(temporary, localPath);
}

export async function saveStoryboardDraft(document: unknown, expectedVersion: number) {
  await requireStoryboardEditor();
  const draft = parseDocument(document);
  const state = await loadStoryboardState();
  if (state.draftVersion !== expectedVersion) throw new Error("The draft changed in another tab. Reload the page before saving.");
  const now = new Date().toISOString();
  const db = database();
  if (db) {
    if (expectedVersion === 0) {
      const { error } = await db.from("storyboard_documents").insert({ project_slug: PROJECT_SLUG, draft, draft_version: 1, saved_at: now });
      if (error) throw new Error(`Saving failed: ${error.message}`);
    } else {
      const { data, error } = await db.from("storyboard_documents").update({ draft, draft_version: expectedVersion + 1, saved_at: now })
        .eq("project_slug", PROJECT_SLUG).eq("draft_version", expectedVersion).select("draft_version").maybeSingle();
      if (error || !data) throw new Error("The draft changed in another tab, or saving failed.");
    }
  } else {
    if (process.env.NODE_ENV === "production") throw new Error("Persistent storyboard storage is not configured on the server.");
    await writeLocal({ ...state, draft, draftVersion: expectedVersion + 1, savedAt: now });
  }
  return { version: expectedVersion + 1, savedAt: now };
}

export async function publishStoryboardDraft(expectedVersion: number) {
  await requireStoryboardEditor();
  const state = await loadStoryboardState();
  if (expectedVersion === 0 || state.draftVersion !== expectedVersion) throw new Error("Save the latest draft before publishing.");
  const now = new Date().toISOString();
  const published = structuredClone(state.draft);
  for (const chapter of published.chapters) for (const section of chapter.sections) {
    if (section.kind !== "comic" || !section.src) continue;
    const overflowing = section.bubbles.find(bubble => !layoutBubbleText(bubble).fits);
    if (overflowing) throw new Error(`Text does not fit a ${overflowing.shape === "rectangle" ? "text panel" : "bubble"} in “${section.title}”. Enlarge it or shorten the text.`);
    const previous = state.published?.chapters.flatMap(item => item.sections).find(item => item.id === section.id);
    if (previous?.kind === "comic" && previous.renderedSrc && previous.renderVersion === COMIC_RENDER_VERSION) {
      const oldContent = { ...previous, renderedSrc: undefined, renderVersion: undefined };
      const newContent = { ...section, renderedSrc: undefined, renderVersion: undefined };
      if (JSON.stringify(oldContent) === JSON.stringify(newContent)) {
        section.renderedSrc = previous.renderedSrc;
        section.renderVersion = COMIC_RENDER_VERSION;
        continue;
      }
    }
    const rendered = await publishComicImage(section);
    section.renderedSrc = rendered.src;
    section.renderVersion = COMIC_RENDER_VERSION;
    section.imageWidth = rendered.imageWidth;
    section.imageHeight = rendered.imageHeight;
  }
  const db = database();
  if (db) {
    const { data, error } = await db.from("storyboard_documents").update({ published, published_version: expectedVersion, published_at: now })
      .eq("project_slug", PROJECT_SLUG).eq("draft_version", expectedVersion).select("published_version").maybeSingle();
    if (error || !data) throw new Error("Publishing failed. Check the draft and try again.");
  } else {
    if (process.env.NODE_ENV === "production") throw new Error("Publishing is not configured on the server.");
    await writeLocal({ ...state, published, publishedVersion: expectedVersion, publishedAt: now });
  }
  return { version: expectedVersion, publishedAt: now, published };
}
