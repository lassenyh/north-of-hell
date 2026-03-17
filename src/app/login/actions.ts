"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateLogin } from "@/lib/supabase/auth";

export async function login(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!username || !password) {
    return;
  }

  const user = await validateLogin(username, password);
  if (!user) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set("noh_auth", user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect("/intro");
}

