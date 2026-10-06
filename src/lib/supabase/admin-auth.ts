import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createPublicClient } from "./server";
import { getAdminSessionId } from "./admin-session";
import { PROJECT_SLUG } from "./storyboard";

async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.STORYBOARD_SUPABASE_SERVER_KEY;
  if (url && key) return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  if (process.env.NODE_ENV === "production") throw new Error("Administrator access is not configured on the server.");
  return createPublicClient();
}

export type ProjectAdminLogin = {
  id: string;
  project_slug: string;
  username: string;
  password: string;
  created_at: string;
  full_name: string | null;
};

export async function validateAdminLogin(
  username: string,
  password: string
): Promise<ProjectAdminLogin | null> {
  if (username.includes("@")) {
    const authClient = await createPublicClient();
    const { data: auth, error: signInError } = await authClient.auth.signInWithPassword({
      email: username,
      password,
    });
    if (signInError || !auth.user) return null;
    return getAuthorizedAuthUser(auth.user.id, auth.user.email ?? username);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_admin_logins")
    .select("*")
    .eq("project_slug", PROJECT_SLUG)
    .eq("username", username)
    .eq("password", password)
    .maybeSingle();

  if (error) {
    console.error("validateAdminLogin error:", error);
    return null;
  }

  return data as ProjectAdminLogin | null;
}

export async function getAdminLoginById(
  session: string
): Promise<ProjectAdminLogin | null> {
  const id = getAdminSessionId(session);
  if (!id) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_admin_logins")
    .select("*")
    .eq("project_slug", PROJECT_SLUG)
    .eq("id", id)
    .maybeSingle();

  if (!error && data) return data as ProjectAdminLogin;
  return getAuthorizedAuthUser(id);
}

async function getAuthorizedAuthUser(id: string, email?: string): Promise<ProjectAdminLogin | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_admin_auth_users")
    .select("user_id, project_slug, created_at")
    .eq("project_slug", PROJECT_SLUG)
    .eq("user_id", id)
    .maybeSingle();
  if (error || !data) return null;

  return {
    id: data.user_id,
    project_slug: data.project_slug,
    username: email ?? "Supabase administrator",
    password: "",
    created_at: data.created_at,
    full_name: null,
  };
}

export async function listAdminLogins(): Promise<ProjectAdminLogin[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_admin_logins")
    .select("*")
    .eq("project_slug", PROJECT_SLUG)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listAdminLogins error:", error);
    return [];
  }

  return (data ?? []) as ProjectAdminLogin[];
}

export async function createAdminLogin(
  username: string,
  password: string,
  fullName?: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("project_admin_logins").insert({
    project_slug: PROJECT_SLUG,
    username,
    password,
    full_name: fullName?.trim() || null,
  });

  if (error) {
    console.error("createAdminLogin error:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function deleteAdminLogin(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_admin_logins")
    .delete()
    .eq("id", id)
    .eq("project_slug", PROJECT_SLUG);

  if (error) {
    console.error("deleteAdminLogin error:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
