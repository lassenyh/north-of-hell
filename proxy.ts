import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ikke beskytt login-siden selv eller statiske filer.
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/storyboard") || // offentlig leseside
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get("noh_auth")?.value;

  // Beskytt hovedsiden (/main), intro og admin-siden, men la / være login-forside.
  if (
    !authCookie &&
    (pathname === "/main" || pathname === "/intro" || pathname.startsWith("/admin"))
  ) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

