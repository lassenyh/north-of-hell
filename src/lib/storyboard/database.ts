import "server-only";
import { createClient } from "@supabase/supabase-js";
import { storyboardLocalMode } from "./mode";

export function storyboardDatabase({ ignoreLocalMode = false }: { ignoreLocalMode?: boolean } = {}) {
  if (storyboardLocalMode && !ignoreLocalMode) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.STORYBOARD_SUPABASE_SERVER_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } });
}
