import Link from "next/link";
import { StoryboardDocumentView } from "@/components/storyboard/StoryboardDocumentView";
import { legacyStoryboardDocument, loadStoryboardState } from "@/lib/storyboard/server";

export const dynamic = "force-dynamic";
export default async function StoryboardPage() {
  const state = await loadStoryboardState();
  const document = state.published ?? await legacyStoryboardDocument();
  return <div style={{ minHeight: "100vh", background: "#11110f" }}><div style={{ maxWidth: 1020, margin: "0 auto", padding: "14px 28px", display: "flex", justifyContent: "space-between", color: "#b99a6b", fontSize: 12 }}><Link href="/main">← North of Hell</Link><span>STORYBOARD</span></div><StoryboardDocumentView document={document} /></div>;
}
