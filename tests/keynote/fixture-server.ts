/** Local-only Supabase HTTP contract fixture backed by real Postgres (PGlite).
 * Auth transport is simulated; app actions, SSR cookies, RLS, SQL and transactions are real.
 * Never imported by application code, never points at an external service.
 */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { database, asRole, EDITOR, OUTSIDER, migration } from "./database";
async function main() {
  const db = await database();
  const sessions = new Map<string, string>();
  const users = {
    [EDITOR]: {
      id: EDITOR,
      aud: "authenticated",
      role: "authenticated",
      email: "editor@example.test",
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
      is_anonymous: false,
    },
    [OUTSIDER]: {
      id: OUTSIDER,
      aud: "authenticated",
      role: "authenticated",
      email: "outsider@example.test",
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
      is_anonymous: false,
    },
  };
  let failSave = false;
  let delaySave = 0;
  function token(id: string) {
    const part = (v: unknown) =>
      Buffer.from(JSON.stringify(v)).toString("base64url");
    const jwt = `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), jti: randomUUID() })}.fixture-signature`;
    sessions.set(jwt, id);
    return jwt;
  }
  const server = createServer(async (req, res) => {
    res.setHeader("content-type", "application/json");
    const send = (status: number, data: unknown) => {
      res.statusCode = status;
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url!, "http://127.0.0.1:54329");
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};
      const bearer = req.headers.authorization?.replace(/^Bearer /, "") ?? "";
      const id = sessions.get(bearer);
      if (url.pathname === "/__test/reset") {
        await db.exec(
          "update keynote_decks set published_revision_id=null; delete from keynote_revisions; delete from keynote_decks;",
        );
        await db.exec(migration.slice(migration.indexOf("do $seed$")));
        failSave = false;
        delaySave = 0;
        return send(200, { ok: true });
      }
      if (url.pathname === "/health") return send(200, { ok: true });
      if (url.pathname === "/__test/fault") {
        failSave = !!body.failSave;
        delaySave = Number(body.delaySave ?? 0);
        return send(200, { ok: true });
      }
      if (url.pathname === "/auth/v1/token") {
        const id =
          body.email === "editor@example.test"
            ? EDITOR
            : body.email === "outsider@example.test"
              ? OUTSIDER
              : null;
        if (!id || body.password !== "local-test-only-password")
          return send(400, {
            error_code: "invalid_credentials",
            msg: "Invalid credentials",
          });
        return send(200, {
          access_token: token(id),
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: randomUUID(),
          user: users[id],
        });
      }
      if (url.pathname === "/auth/v1/user")
        return id
          ? send(200, users[id as keyof typeof users])
          : send(401, { msg: "Invalid JWT", code: "bad_jwt" });
      if (url.pathname === "/auth/v1/logout") {
        sessions.delete(bearer);
        return send(200, {});
      }
      const role =
        bearer === "local-service-test-key"
          ? "service_role"
          : id
            ? "authenticated"
            : "anon";
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const fn = url.pathname.split("/").at(-1);
        if (fn !== "keynote_save" && fn !== "keynote_publish")
          return send(404, {});
        if (fn === "keynote_save") {
          if (delaySave) await new Promise((r) => setTimeout(r, delaySave));
          if (failSave) {
            failSave = false;
            return send(503, {
              code: "TEST_OFFLINE",
              message: "Simulated save failure",
            });
          }
        }
        const sql =
          fn === "keynote_save"
            ? "select keynote_save($1,$2,$3) as result"
            : "select keynote_publish($1,$2) as result";
        const args =
          fn === "keynote_save"
            ? [body.project, body.expected_version, body.document]
            : [body.project, body.expected_version];
        const result = await asRole(db, role, id ?? null, (tx) =>
          tx.query<{ result: unknown }>(sql, args),
        );
        return send(200, result.rows[0].result);
      }
      const table = url.pathname.replace("/rest/v1/", "");
      if (
        !["keynote_editors", "keynote_decks", "keynote_revisions"].includes(
          table,
        ) ||
        req.method !== "GET"
      )
        return send(404, {});
      const columns = (url.searchParams.get("select") ?? "*").split(",");
      const allowed = [
        "*",
        "user_id",
        "project_slug",
        "draft",
        "draft_version",
        "published_revision_id",
        "id",
        "document",
        "published_at",
      ];
      if (!columns.every((c) => allowed.includes(c))) return send(400, {});
      const args: string[] = [];
      const where: string[] = [];
      for (const col of ["project_slug", "user_id", "id"]) {
        const filter = url.searchParams.get(col);
        if (filter?.startsWith("eq.")) {
          args.push(filter.slice(3));
          where.push(`${col}=$${args.length}`);
        }
      }
      const sql = `select ${columns.join(",")} from ${table} ${where.length ? "where " + where.join(" and ") : ""} ${url.searchParams.has("order") ? "order by published_at desc" : ""} limit 50`;
      const result = await asRole(db, role, id ?? null, (tx) =>
        tx.query(sql, args),
      );
      if (req.headers.accept?.includes("vnd.pgrst.object")) {
        if (result.rows.length !== 1)
          return send(406, {
            code: "PGRST116",
            details: `The result contains ${result.rows.length} rows`,
            message: "JSON object requested, multiple (or no) rows returned",
          });
        return send(200, result.rows[0]);
      }
      return send(200, result.rows);
    } catch (error) {
      const e = error as { code?: string; message: string };
      send(400, { code: e.code ?? "FIXTURE_ERROR", message: e.message });
    }
  });
  server.listen(54329, "127.0.0.1", () =>
    console.log("Local Postgres/Supabase contract fixture: 127.0.0.1:54329"),
  );
}
void main();
