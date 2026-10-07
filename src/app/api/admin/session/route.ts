import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminLoginById } from "@/lib/supabase/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = (await cookies()).get("noh_admin_auth")?.value;
  let authenticated = false;
  if (session) {
    try {
      authenticated = (await getAdminLoginById(session)) !== null;
    } catch {
      authenticated = false;
    }
  }
  return NextResponse.json({ authenticated }, { headers: { "Cache-Control": "private, no-store" } });
}
