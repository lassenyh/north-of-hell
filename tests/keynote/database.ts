import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
export const EDITOR = "11111111-1111-4111-8111-111111111111";
export const OUTSIDER = "22222222-2222-4222-8222-222222222222";
export const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260923195919_keynote_admin.sql",
    import.meta.url,
  ),
  "utf8",
);
export async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
  `);
  await db.exec(migration);
  await db.query("insert into auth.users values ($1),($2)", [EDITOR, OUTSIDER]);
  await db.query("insert into keynote_editors values ('north-of-hell',$1)", [
    EDITOR,
  ]);
  return db;
}
export async function asRole<T>(
  db: PGlite,
  role: "anon" | "authenticated" | "service_role",
  user: string | null,
  fn: (tx: Parameters<Parameters<PGlite["transaction"]>[0]>[0]) => Promise<T>,
  anonymous = false,
) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query(
      "select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',$2,true)",
      [user ?? "", JSON.stringify({ sub: user, is_anonymous: anonymous })],
    );
    return fn(tx);
  });
}
