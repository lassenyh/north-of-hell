import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { parseDeck, PROJECT, SEED_DECK } from "./model";

export function keynoteConfig() {
  const url = process.env.KEYNOTE_SUPABASE_URL;
  const key = process.env.KEYNOTE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      "Keynote admin is not configured. See docs/KEYNOTE_ADMIN_REVIEW.md.",
    );
  return { url, key };
}
export async function keynoteClient() {
  const { url, key } = keynoteConfig();
  const jar = await cookies();
  return createServerClient(url, key, {
    cookieOptions: {
      name: "noh_keynote_session",
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Proxy refreshes Server Component sessions. */
        }
      },
    },
  });
}
export async function requireEditor() {
  const client = await keynoteClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user || user.is_anonymous)
    throw new Error("Sign in as an editor.");
  const { data: member, error: memberError } = await client
    .from("keynote_editors")
    .select("user_id")
    .eq("project_slug", PROJECT)
    .eq("user_id", user.id)
    .maybeSingle();
  if (memberError || !member)
    throw new Error("You do not have editor access to this project.");
  return client;
}
export async function loadEditor() {
  const client = await requireEditor();
  const { data, error } = await client
    .from("keynote_decks")
    .select("draft, draft_version")
    .eq("project_slug", PROJECT)
    .single();
  if (error || !data)
    throw new Error(
      "Could not load the draft. Check the migration and access settings.",
    );
  return {
    document: parseDeck(data.draft),
    version: Number(data.draft_version),
  };
}
export async function publishedDeck() {
  // Explicit rollout switch: disabled uses the checked-in original; enabled never masks errors.
  if (process.env.KEYNOTE_PUBLISHED_SOURCE !== "database") return SEED_DECK;
  const { url } = keynoteConfig();
  const key = process.env.KEYNOTE_SUPABASE_SERVER_KEY;
  if (!key) throw new Error("Published Keynote is missing server configuration.");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }),
    },
  });
  const { data: deck, error } = await client
    .from("keynote_decks")
    .select("published_revision_id")
    .eq("project_slug", PROJECT)
    .single();
  if (error || !deck?.published_revision_id)
    throw new Error("Could not load the published Keynote.");
  const { data: revision, error: revisionError } = await client
    .from("keynote_revisions")
    .select("document")
    .eq("id", deck.published_revision_id)
    .eq("project_slug", PROJECT)
    .single();
  if (revisionError || !revision)
    throw new Error("Could not load the published revision.");
  return parseDeck(revision.document, true);
}
