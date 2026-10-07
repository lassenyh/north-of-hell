"use server";
import { redirect } from "next/navigation";
import { keynoteClient, requireEditor } from "@/lib/keynote/server";
export async function loginEditor(
  _previous: { error: string },
  form: FormData,
) {
  try {
    const client = await keynoteClient();
    const { error } = await client.auth.signInWithPassword({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });
    if (error)
      return { error: "Could not sign in. Check your email and password." };
    try {
      await requireEditor();
    } catch {
      await client.auth.signOut();
      return { error: "This user does not have editor access." };
    }
  } catch {
    return {
      error: "Sign in is unavailable. Contact the project administrator.",
    };
  }
  redirect("/admin/keynote");
}
export async function logoutEditor() {
  const client = await keynoteClient();
  await client.auth.signOut();
  redirect("/admin/keynote/login");
}
