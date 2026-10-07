import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/storyboard")) {
    return NextResponse.next();
  }

  const authMain = request.cookies.get("noh_auth")?.value;
  const authAdmin = request.cookies.get("noh_admin_auth")?.value;

  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith("/admin/storyboard") && process.env.NODE_ENV !== "production" && process.env.STORYBOARD_REVIEW_MODE === "local") return NextResponse.next();
    if (!authAdmin) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/main" || pathname.startsWith("/main/") || pathname === "/intro") {
    if (!authMain) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
