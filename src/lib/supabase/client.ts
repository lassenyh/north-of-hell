/**
 * Supabase client for the browser (Client Components).
 * Use this in any component that has "use client" at the top.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createClient() {
  const supabaseUrl = "https://alowszvgmgmfrixpxscw.supabase.co";
  const supabaseAnonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsb3dzenZnbWdtZnJpeHB4c2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTg4MjQsImV4cCI6MjA4OTMzNDgyNH0.R2996ZnZ_9W5eMzePUj9LR9ISHKXp9TIjI5komq-7CI";

  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}
