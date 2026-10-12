import "server-only";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PROJECT_SLUG } from "@/lib/supabase/storyboard";
import { parseDocument, type StoryboardDocument } from "./model";
import { storyboardDatabase } from "./database";
import { requireStoryboardEditor } from "./server";
import { storyboardAssetSources, validStoryboardShareId } from "./share";

type StoredSnapshot = { publishedVersion: number; document: StoryboardDocument; assetSources: string[] };

const localStatePath = process.env.STORYBOARD_LOCAL_STATE_PATH || join(process.cwd(), ".local", "storyboard-state.json");
const localSnapshotsPath = join(dirname(localStatePath), "storyboard-share-snapshots");
const localPublishedPath = join(dirname(localStatePath), "storyboard-published-supabase.json");

async function loadLocalPublishedMirror() {
  try {
    const stored = JSON.parse(await readFile(localPublishedPath, "utf8")) as {
      source?: string; publishedVersion?: number; document?: unknown;
    };
    if (stored.source !== "supabase" || typeof stored.publishedVersion !== "number" ||
        !Number.isSafeInteger(stored.publishedVersion) || stored.publishedVersion < 0) {
      throw new Error("The local published storyboard mirror is invalid.");
    }
    return { document: parseDocument(stored.document), version: stored.publishedVersion };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

export async function loadLatestPublishedStoryboard() {
  // The share reader may read Supabase while the studio remains isolated in local review mode.
  const db = storyboardDatabase({ ignoreLocalMode: true });
  if (db) {
    const { data, error } = await db.from("storyboard_documents").select("published,published_version")
      .eq("project_slug", PROJECT_SLUG).maybeSingle();
    if (error) throw new Error(`Could not load published storyboard: ${error.message}`);
    if (!data?.published || data.published_version === null) return null;
    return { document: parseDocument(data.published), version: Number(data.published_version) };
  }
  // Local sharing uses an explicit copy of Supabase's publication, never the local studio draft or its old publication.
  if (process.env.NODE_ENV === "production") return null;
  return loadLocalPublishedMirror();
}

export async function createStoryboardShareSnapshot() {
  await requireStoryboardEditor();
  const current = await loadLatestPublishedStoryboard();
  if (!current) throw new Error("Publish the storyboard before creating a fixed link.");
  const { document, version: publishedVersion } = current;
  const id = crypto.randomUUID();
  const assetSources = storyboardAssetSources(document);
  const db = storyboardDatabase();
  if (db) {
    const { error } = await db.from("storyboard_share_snapshots").insert({
      id, project_slug: PROJECT_SLUG, published_version: publishedVersion,
      document, asset_sources: assetSources,
    });
    if (error) throw new Error(`Could not create a fixed share link: ${error.message}`);
  } else {
    if (process.env.NODE_ENV === "production") throw new Error("Share storage is not configured on the server.");
    await mkdir(localSnapshotsPath, { recursive: true });
    const snapshot: StoredSnapshot = { publishedVersion, document, assetSources };
    await writeFile(join(localSnapshotsPath, `${id}.json`), JSON.stringify(snapshot), { flag: "wx" });
  }
  return { id, publishedVersion };
}

export async function loadStoryboardShareSnapshot(id: string) {
  if (!validStoryboardShareId(id)) return null;
  const db = storyboardDatabase();
  if (db) {
    const { data, error } = await db.from("storyboard_share_snapshots").select("document")
      .eq("id", id).eq("project_slug", PROJECT_SLUG).maybeSingle();
    if (error) throw new Error(`Could not load shared storyboard: ${error.message}`);
    return data ? parseDocument(data.document) : null;
  }
  if (process.env.NODE_ENV === "production") return null;
  try {
    const snapshot = JSON.parse(await readFile(join(localSnapshotsPath, `${id}.json`), "utf8")) as StoredSnapshot;
    return parseDocument(snapshot.document);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

export async function storyboardSnapshotUsesAsset(src: string) {
  const db = storyboardDatabase();
  if (db) {
    const { data, error } = await db.from("storyboard_share_snapshots").select("id")
      .eq("project_slug", PROJECT_SLUG).contains("asset_sources", [src]).limit(1);
    if (error) throw new Error(`Could not check shared storyboards: ${error.message}`);
    return (data?.length ?? 0) > 0;
  }
  if (process.env.NODE_ENV === "production") return false;
  let filenames: string[];
  try { filenames = await readdir(localSnapshotsPath); }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
  for (const filename of filenames) {
    if (!filename.endsWith(".json")) continue;
    const snapshot = JSON.parse(await readFile(join(localSnapshotsPath, filename), "utf8")) as StoredSnapshot;
    if (snapshot.assetSources.includes(src)) return true;
  }
  return false;
}
