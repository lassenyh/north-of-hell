import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Keynote uses real Supabase Auth; never accept the legacy admin cookie here.
  if (pathname === "/admin/keynote" || pathname.startsWith("/admin/keynote/")) {
    let response = NextResponse.next({ request });
    const url = process.env.KEYNOTE_SUPABASE_URL;
    const key = process.env.KEYNOTE_SUPABASE_PUBLISHABLE_KEY;
    if (url && key) {
      const client = createServerClient(url, key, {
        cookieOptions: {
          name: "noh_keynote_session",
          sameSite: "lax",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
        },
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (values) => {
            values.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({ request });
            values.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      });
      await client.auth.getUser();
    }
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/storyboard")
  ) {
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

  if (!authMain && (pathname === "/main" || pathname === "/intro")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
