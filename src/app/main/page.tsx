import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { publishedDeck } from "@/lib/keynote/server";
import KeynoteClient from "./KeynoteClient";

export const dynamic = "force-dynamic";

export default async function MainLandingPage() {
  const cookieStore = await cookies();
  const auth = cookieStore.get("noh_auth")?.value;
  if (!auth) {
    redirect("/login");
  }

  return <KeynoteClient deck={await publishedDeck()} />;
}
