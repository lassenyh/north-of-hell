import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const ADMIN_SESSION_AGE_SECONDS = SESSION_AGE_MS / 1000;

function secret(): string | null {
  const configured = process.env.STORYBOARD_SUPABASE_SERVER_KEY;
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? null : "north-of-hell-local-admin-session";
}

function signature(value: string, key: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

export function createAdminSession(id: string, source: "legacy" | "supabase" = "legacy"): string {
  const key = secret();
  if (!key) throw new Error("Administrator sign-in is not configured on the server.");
  const payload = `${id}.${source}.${Date.now()}`;
  return `${payload}.${signature(payload, key)}`;
}

export function getAdminSession(cookie: string | undefined, now = Date.now()): { id: string; source: "legacy" | "supabase" } | null {
  const key = secret();
  if (!key || !cookie) return null;
  const parts = cookie.split(".");
  if (parts.length !== 3 && parts.length !== 4) return null;
  const [id, source, issuedAt, supplied] = parts.length === 4
    ? parts
    : [parts[0], "legacy", parts[1], parts[2]];
  if (source !== "legacy" && source !== "supabase") return null;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^\d{13}$/.test(issuedAt) || !/^[0-9a-f]{64}$/i.test(supplied)) return null;
  const age = now - Number(issuedAt);
  if (age < -5 * 60 * 1000 || age > SESSION_AGE_MS) return null;
  const expected = signature(parts.slice(0, -1).join("."), key);
  if (!timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(expected, "hex"))) return null;
  return { id, source };
}

export function getAdminSessionId(cookie: string | undefined, now = Date.now()): string | null {
  return getAdminSession(cookie, now)?.id ?? null;
}
