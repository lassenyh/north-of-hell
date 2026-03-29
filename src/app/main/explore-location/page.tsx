import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ExploreLocationClient } from "./ExploreLocationClient";

export const dynamic = "force-dynamic";

export default async function ExploreLocationPage() {
  const cookieStore = await cookies();
  if (!cookieStore.get("noh_auth")?.value) {
    redirect("/login");
  }

  return <ExploreLocationClient />;
}
