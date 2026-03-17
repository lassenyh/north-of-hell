/**
 * Supabase client for the server (Server Components, API routes, Server Actions).
 *
 * For this simple use-case we don't need advanced auth/session handling, so we
 * use the basic client from @supabase/supabase-js directly instead of the SSR helper.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function createClient() {
  // For this project we hard-code the Supabase URL and anon key that you provided.
  // This avoids environment issues in dev and keeps the setup beginner-friendly.
  const supabaseUrl = "https://alowszvgmgmfrixpxscw.supabase.co";
  const supabaseAnonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsb3dzenZnbWdtZnJpeHB4c2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTg4MjQsImV4cCI6MjA4OTMzNDgyNH0.R2996ZnZ_9W5eMzePUj9LR9ISHKXp9TIjI5komq-7CI";

  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}
