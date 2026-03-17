import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { IntroClient } from "./IntroClient";

export const dynamic = "force-dynamic";

export default function IntroPage() {
  const auth = cookies().get("noh_auth")?.value;
  if (!auth) {
    redirect("/login");
  }

  return <IntroClient />;
}

