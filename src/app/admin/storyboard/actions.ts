"use server";
import { publishStoryboardDraft, saveStoryboardDraft } from "@/lib/storyboard/server";

export async function saveDraftAction(document: unknown, version: number) {
  try { return { ok: true as const, ...(await saveStoryboardDraft(document, version)) }; }
  catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Saving failed." }; }
}
export async function publishDraftAction(version: number) {
  try { return { ok: true as const, ...(await publishStoryboardDraft(version)) }; }
  catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Publishing failed." }; }
}
