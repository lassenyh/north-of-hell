import { redirect } from "next/navigation";
import { loadEditor, requireEditor } from "@/lib/keynote/server";
import KeynoteEditor from "./KeynoteEditor";
export const dynamic = "force-dynamic";
export default async function KeynoteAdmin() {
  try {
    await requireEditor();
  } catch {
    redirect("/admin/keynote/login");
  }
  const initial = await loadEditor();
  return (
    <KeynoteEditor
      initial={initial}
      localReview={
        process.env.KEYNOTE_REVIEW_MODE === "local" &&
        process.env.KEYNOTE_SUPABASE_URL === "http://127.0.0.1:54329"
      }
    />
  );
}
