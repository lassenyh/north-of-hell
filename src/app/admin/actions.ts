"use server";

/**
 * Server Action: update the manuscript text for one frame.
 * Called when you click Save in the admin page.
 */

import { updateFrameText as updateFrameTextDb } from "@/lib/supabase/storyboard";
import {
  createLogin as createLoginDb,
  deleteLogin as deleteLoginDb,
  listLogins,
} from "@/lib/supabase/auth";

export async function updateFrameText(frameId: string, text: string) {
  return updateFrameTextDb(frameId, text);
}

export async function createLogin(
  username: string,
  password: string,
  fullName?: string,
  company?: string
) {
  if (!username || !password) {
    return { ok: false, error: "Username and password are required." };
  }
  return createLoginDb(username, password, fullName, company);
}

export async function getLogins() {
  return listLogins();
}

export async function deleteLogin(id: string) {
  if (!id) {
    return { ok: false, error: "Missing id" };
  }
  return deleteLoginDb(id);
}
