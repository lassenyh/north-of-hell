import { createClient } from "./server";
import { PROJECT_SLUG } from "./storyboard";

export type ProjectLogin = {
  id: string;
  project_slug: string;
  username: string;
  password: string;
  created_at: string;
  full_name: string | null;
  company: string | null;
};

export async function validateLogin(
  username: string,
  password: string
): Promise<ProjectLogin | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_logins")
    .select("*")
    .eq("project_slug", PROJECT_SLUG)
    .eq("username", username)
    .eq("password", password)
    .maybeSingle();

  if (error) {
    console.error("validateLogin error:", error);
    return null;
  }

  return data as ProjectLogin | null;
}

export async function listLogins(): Promise<ProjectLogin[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_logins")
    .select("*")
    .eq("project_slug", PROJECT_SLUG)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listLogins error:", error);
    return [];
  }

  return (data ?? []) as ProjectLogin[];
}

export async function createLogin(
  username: string,
  password: string,
  fullName?: string,
  company?: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("project_logins").insert({
    project_slug: PROJECT_SLUG,
    username,
    password,
    full_name: fullName ?? null,
    company: company ?? null,
  });

  if (error) {
    console.error("createLogin error:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function deleteLogin(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_logins")
    .delete()
    .eq("id", id)
    .eq("project_slug", PROJECT_SLUG);

  if (error) {
    console.error("deleteLogin error:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}


