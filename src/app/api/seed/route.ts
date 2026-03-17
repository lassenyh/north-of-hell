/**
 * API route: POST /api/seed
 *
 * Seeds the storyboard_frames table from the current images on disk
 * (public/storyboard/...). Run this once after creating the Supabase table
 * so that /storyboard and /admin have data.
 *
 * Call it from the admin page with a "Seed database" button, or run:
 *   curl -X POST http://localhost:3000/api/seed
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getComicFrames } from "@/lib/comic-frames";
import { PROJECT_SLUG } from "@/lib/supabase/storyboard";

export async function POST() {
  try {
    const frames = getComicFrames([]);
    if (frames.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No frames found on disk (check public/storyboard)" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const rows = frames.map((frame, index) => ({
      project_slug: PROJECT_SLUG,
      image_src: frame.src,
      frame_order: index,
      text: frame.manuscript || "",
    }));

    const { data, error } = await supabase
      .from("storyboard_frames")
      .upsert(rows, {
        onConflict: "project_slug,image_src",
        ignoreDuplicates: false,
      })
      .select("id");

    if (error) {
      console.error("Seed error:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      count: data?.length ?? frames.length,
      message: `Seeded ${frames.length} frames.`,
    });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
