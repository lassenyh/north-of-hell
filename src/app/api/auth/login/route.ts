import { NextResponse } from "next/server";
import { validateLogin } from "@/lib/supabase/auth";

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Incorrect username or password." },
      { status: 400 }
    );
  }

  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "").trim();

  if (!username || !password) {
    return NextResponse.json(
      { error: "Incorrect username or password." },
      { status: 401 }
    );
  }

  const user = await validateLogin(username, password);
  if (!user) {
    return NextResponse.json(
      { error: "Incorrect username or password." },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true as const });
  res.cookies.set("noh_auth", user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
