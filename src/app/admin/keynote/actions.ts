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
      throw new Error("Ugyldig versjon.");
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
            ? "Kladden er endret i en annen fane. Eksporter dine endringer før du henter siste kladd."
            : "Lagringen feilet. Prøv igjen; lokale endringer er beholdt.",
      };
    return { ok: true, version: Number(data) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Kunne ikke lagre.",
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
          "Publisering er ikke aktivert i dette miljøet. Kladden er lagret; kontakt prosjektansvarlig.",
      };
    if (!Number.isSafeInteger(version) || version < 1)
      throw new Error("Ugyldig versjon.");
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
            ? "Kladden ble endret i en annen fane. Hent siste kladd før publisering."
            : "Publisering feilet. Kontroller startslide og prøv igjen.",
      };
    return { ok: true as const, id: String(data) };
  } catch {
    return {
      ok: false as const,
      error: "Publisering krever redaktørtilgang. Logg inn på nytt.",
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
  if (error) throw new Error("Kunne ikke hente historikken.");
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
  if (error || !data) throw new Error("Kunne ikke hente revisjonen.");
  return parseDeck(data.document, true);
}
