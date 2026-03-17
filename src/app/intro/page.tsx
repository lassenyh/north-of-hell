import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { IntroClient } from "./IntroClient";

export const dynamic = "force-dynamic";

export default async function IntroPage() {
  const cookieStore = await cookies();
  const auth = cookieStore.get("noh_auth")?.value;
  if (!auth) {
    redirect("/login");
  }

  return <IntroClient />;
}


