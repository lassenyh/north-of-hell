"use server";
import { parseDeck, PROJECT } from "@/lib/keynote/model";
import { requireEditor } from "@/lib/keynote/server";
import type { SaveResult } from "@/lib/keynote/save-queue";

export async function saveDraft(
  document: unknown,
  version: number,
): Promise<SaveResult> {
  try {
    const client = await requireEditor();
    const draft = parseDeck(document);
    if (!Number.isSafeInteger(version) || version < 1)
      throw new Error("Invalid version.");
    const { data, error } = await client.rpc("keynote_save", {
      project: PROJECT,
      expected_version: version,
      document: draft,
    });
    if (error)
      return {
        ok: false,
        conflict: error.code === "40001",
        error:
          error.code === "40001"
            ? "The draft changed in another tab. Export your changes before loading the latest draft."
            : "Saving failed. Try again; your local changes were kept.",
      };
    return { ok: true, version: Number(data) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save.",
    };
  }
}
export async function publishDraft(version: number) {
  try {
    const client = await requireEditor();
    if (
      process.env.KEYNOTE_PUBLISHED_SOURCE !== "database" ||
      !process.env.KEYNOTE_SUPABASE_SERVER_KEY
    )
      return {
        ok: false as const,
        error:
          "Publishing is not enabled in this environment. The draft is saved; contact the project administrator.",
      };
    if (!Number.isSafeInteger(version) || version < 1)
      throw new Error("Invalid version.");
    const { data, error } = await client.rpc("keynote_publish", {
      project: PROJECT,
      expected_version: version,
    });
    if (error)
      return {
        ok: false as const,
        conflict: error.code === "40001",
        error:
          error.code === "40001"
            ? "The draft changed in another tab. Load the latest draft before publishing."
            : "Publishing failed. Check the starting slide and try again.",
      };
    return { ok: true as const, id: String(data) };
  } catch {
    return {
      ok: false as const,
      error: "Publishing requires editor access. Sign in again.",
    };
  }
}
export async function listRevisions() {
  const client = await requireEditor();
  const { data, error } = await client
    .from("keynote_revisions")
    .select("id, published_at")
    .eq("project_slug", PROJECT)
    .order("published_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Could not load history.");
  return data as { id: string; published_at: string }[];
}
export async function readRevision(id: string) {
  const client = await requireEditor();
  const { data, error } = await client
    .from("keynote_revisions")
    .select("document")
    .eq("project_slug", PROJECT)
    .eq("id", id)
    .single();
  if (error || !data) throw new Error("Could not load the revision.");
  return parseDeck(data.document, true);
}
