"use server";

/**
 * Server Action: update the manuscript text for one frame.
 * Called when you click Save in the admin page.
 */

import { updateFrameText as updateFrameTextDb } from "@/lib/supabase/storyboard";

export async function updateFrameText(frameId: string, text: string) {
  return updateFrameTextDb(frameId, text);
}
