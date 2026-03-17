"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { updateFrameText as updateFrameTextDb } from "@/lib/supabase/storyboard";
import {
  createLogin as createLoginDb,
  deleteLogin as deleteLoginDb,
  listLogins,
} from "@/lib/supabase/auth";
import {
  createAdminLogin as createAdminLoginDb,
  deleteAdminLogin as deleteAdminLoginDb,
  getAdminLoginById,
  listAdminLogins,
} from "@/lib/supabase/admin-auth";

async function requireAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const id = cookieStore.get("noh_admin_auth")?.value;
  if (!id) return false;
  const admin = await getAdminLoginById(id);
  return admin !== null;
}

export async function adminLogout() {
  const cookieStore = await cookies();
  cookieStore.delete("noh_admin_auth");
  redirect("/admin/login");
}

export async function updateFrameText(frameId: string, text: string) {
  if (!(await requireAdminSession())) {
    return { ok: false, error: "Unauthorized" };
  }
  return updateFrameTextDb(frameId, text);
}

export async function createLogin(
  username: string,
  password: string,
  fullName?: string,
  company?: string
) {
  if (!(await requireAdminSession())) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!username || !password) {
    return { ok: false, error: "Username and password are required." };
  }
  return createLoginDb(username, password, fullName, company);
}

export async function getLogins() {
  if (!(await requireAdminSession())) {
    return [];
  }
  return listLogins();
}

export async function deleteLogin(id: string) {
  if (!(await requireAdminSession())) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!id) {
    return { ok: false, error: "Missing id" };
  }
  return deleteLoginDb(id);
}

export async function createAdminLogin(
  username: string,
  password: string,
  fullName?: string
) {
  if (!(await requireAdminSession())) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!username || !password) {
    return { ok: false, error: "Username and password are required." };
  }
  return createAdminLoginDb(username, password, fullName);
}

export async function getAdminLogins() {
  if (!(await requireAdminSession())) {
    return [];
  }
  return listAdminLogins();
}

export async function deleteAdminLogin(id: string) {
  if (!(await requireAdminSession())) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!id) {
    return { ok: false, error: "Missing id" };
  }
  const cookieStore = await cookies();
  if (cookieStore.get("noh_admin_auth")?.value === id) {
    return {
      ok: false,
      error:
        "You can’t remove your own admin account while signed in. Use another admin or Supabase.",
    };
  }
  return deleteAdminLoginDb(id);
}
