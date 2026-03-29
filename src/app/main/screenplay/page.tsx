import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ScreenplayReaderClient } from "./ScreenplayReaderClient";

export const dynamic = "force-dynamic";

export default async function ScreenplayPage() {
  const cookieStore = await cookies();
  if (!cookieStore.get("noh_auth")?.value) {
    redirect("/login");
  }

  return <ScreenplayReaderClient />;
}
