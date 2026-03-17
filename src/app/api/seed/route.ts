/**
 * API route: POST /api/seed
 *
 * Synkroniserer storyboard_frames med bilder på disk (public/storyboard/...).
 * - Nye bilder: settes inn med tom tekst.
 * - Eksisterende bilder: kun frame_order oppdateres — tekst i DB endres ALDRI.
 * - Bilder som ikke lenger finnes på disk: rad slettes (kun hvis du har fjernet filer).
 *
 * All manuskripttekst skal redigeres manuelt i admin.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminLoginById } from "@/lib/supabase/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { getComicFrames } from "@/lib/comic-frames";
import { PROJECT_SLUG } from "@/lib/supabase/storyboard";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const adminId = cookieStore.get("noh_admin_auth")?.value;
    if (!adminId || !(await getAdminLoginById(adminId))) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const frames = getComicFrames([]);
    if (frames.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No frames found on disk (check public/storyboard)",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: existingRows, error: fetchError } = await supabase
      .from("storyboard_frames")
      .select("id, image_src")
      .eq("project_slug", PROJECT_SLUG);

    if (fetchError) {
      console.error("Seed fetch error:", fetchError);
      return NextResponse.json(
        { ok: false, error: fetchError.message },
        { status: 500 }
      );
    }

    const existingBySrc = new Map(
      (existingRows ?? []).map((r) => [r.image_src, r.id])
    );
    const diskSrcs = new Set(frames.map((f) => f.src));

    let inserted = 0;
    let orderUpdated = 0;
    let deleted = 0;

    for (let i = 0; i < frames.length; i += 1) {
      const image_src = frames[i].src;
      const id = existingBySrc.get(image_src);

      if (id) {
        const { error } = await supabase
          .from("storyboard_frames")
          .update({
            frame_order: i,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);

        if (error) {
          console.error("Seed update error:", error);
          return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
          );
        }
        orderUpdated += 1;
      } else {
        const { error } = await supabase.from("storyboard_frames").insert({
          project_slug: PROJECT_SLUG,
          image_src,
          frame_order: i,
          text: "",
          updated_at: new Date().toISOString(),
        });

        if (error) {
          console.error("Seed insert error:", error);
          return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
          );
        }
        inserted += 1;
      }
    }

    for (const row of existingRows ?? []) {
      if (!diskSrcs.has(row.image_src)) {
        const { error } = await supabase
          .from("storyboard_frames")
          .delete()
          .eq("id", row.id);

        if (error) {
          console.error("Seed delete error:", error);
          return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
          );
        }
        deleted += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      count: frames.length,
      inserted,
      orderUpdated,
      deleted,
      message: `Synced ${frames.length} frames from disk. Text in DB was not modified for existing images.`,
    });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
