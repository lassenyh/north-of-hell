import { NextResponse } from "next/server";

const ACCESS_CODE = process.env.MAIN_SITE_ACCESS_CODE ?? "temp";

export async function POST(request: Request) {
  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Incorrect code." },
      { status: 400 }
    );
  }

  const code = String(body.code ?? "").trim();

  if (!code || code !== ACCESS_CODE) {
    return NextResponse.json(
      { error: "Incorrect code." },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true as const });
  res.cookies.set("noh_auth", "access-granted", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
