"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateAdminLogin } from "@/lib/supabase/admin-auth";

export type AdminLoginState = {
  error?: string;
};

export async function adminLogin(
  _prevState: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!username || !password) {
    return { error: "Incorrect username or password." };
  }

  const user = await validateAdminLogin(username, password);
  if (!user) {
    return { error: "Incorrect username or password." };
  }

  const cookieStore = await cookies();
  cookieStore.set("noh_admin_auth", user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect("/admin");
}
