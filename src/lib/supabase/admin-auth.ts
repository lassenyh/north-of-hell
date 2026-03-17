import { createClient } from "./server";
import { PROJECT_SLUG } from "./storyboard";

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
  id: string
): Promise<ProjectAdminLogin | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_admin_logins")
    .select("*")
    .eq("project_slug", PROJECT_SLUG)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as ProjectAdminLogin;
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
