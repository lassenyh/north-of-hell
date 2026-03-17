/**
 * Data layer for storyboard frames in Supabase.
 * - getStoryboardFrames: fetch all frames for a project (for public + admin pages)
 * - updateFrameText: update the manuscript text for one frame (for admin save)
 */

import { createClient } from "./server";

export type StoryboardFrame = {
  id: string;
  project_slug: string;
  image_src: string;
  frame_order: number;
  text: string;
  updated_at: string;
};

const PROJECT_SLUG = "north-of-hell";

/**
 * Fetches all storyboard frames for the project, ordered by frame_order.
 * Use this in the /storyboard page (public) and /admin page.
 */
export async function getStoryboardFrames(): Promise<StoryboardFrame[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("storyboard_frames")
    .select("*")
    .eq("project_slug", PROJECT_SLUG)
    .order("frame_order", { ascending: true });

  if (error) {
    console.error("getStoryboardFrames error:", error);
    return [];
  }
  return (data ?? []) as StoryboardFrame[];
}

/**
 * Updates the manuscript text for a single frame.
 * Used when you click Save in the admin page.
 */
export async function updateFrameText(
  frameId: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("storyboard_frames")
    .update({ text, updated_at: new Date().toISOString() })
    .eq("id", frameId);

  if (error) {
    console.error("updateFrameText error:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export { PROJECT_SLUG };
