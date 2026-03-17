"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateLogin } from "@/lib/supabase/auth";

export type LoginState = {
  error?: string;
};

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!username || !password) {
    return { error: "Incorrect username or password." };
  }

  const user = await validateLogin(username, password);
  if (!user) {
    return { error: "Incorrect username or password." };
  }

  const cookieStore = await cookies();
  cookieStore.set("noh_auth", user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect("/intro");
}

