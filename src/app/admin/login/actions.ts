"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateAdminLogin } from "@/lib/supabase/admin-auth";
import { ADMIN_SESSION_AGE_SECONDS, createAdminSession } from "@/lib/supabase/admin-session";

export type AdminLoginState = {
  error?: string;
};

export async function adminLogin(
  _prevState: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Incorrect username or password." };
  }

  const user = await validateAdminLogin(username, password);
  if (!user) {
    return { error: "Incorrect username or password." };
  }

  const cookieStore = await cookies();
  cookieStore.set("noh_admin_auth", createAdminSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_SESSION_AGE_SECONDS,
  });

  redirect("/storyboard-studio");
}
