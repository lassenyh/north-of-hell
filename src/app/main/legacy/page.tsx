import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MainLandingClient } from "../MainLandingClient";

export const dynamic = "force-dynamic";

export default async function MainLandingPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("noh_auth")?.value;
  if (!auth) {
    redirect("/login");
  }

  const { from } = await searchParams;
  return <MainLandingClient arrivalFromAltThree animateFromLogin={from === "login-alt-3"} />;
}
