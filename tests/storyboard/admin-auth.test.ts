import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Isolate the server-only module while exercising its real sign-in/authorization flow.
function loginFixture({ passwordValid = true, authorized = true } = {}) {
  let signedIn = false;
  let clientCount = 0;
  const client = {
    auth: {
      async signInWithPassword() {
        signedIn = passwordValid;
        return { data: { user: passwordValid ? { id: "admin-id", email: "lasse@aparent.tv" } : null }, error: passwordValid ? null : { message: "Invalid credentials" } };
      },
    },
    from(table: string) {
      assert.equal(table, "project_admin_auth_users");
      const query = {
        select() { return query; },
        eq() { return query; },
        async maybeSingle() {
          return { data: signedIn && authorized ? { user_id: "admin-id", project_slug: "north-of-hell", created_at: "2026-10-15" } : null, error: null };
        },
      };
      return query;
    },
  };
  const authModule = { exports: {} as { validateAdminLogin: (email: string, password: string) => Promise<{ id: string; auth_source: string } | null> } };
  const dependencies: Record<string, unknown> = {
    "server-only": {},
    "@supabase/supabase-js": {},
    "./server": { createClient: async () => {
      clientCount++;
      // A fresh client has no signed-in identity, just like the local anon client.
      if (clientCount > 1) signedIn = false;
      return client;
    } },
    "./admin-session": {},
    "./storyboard": { PROJECT_SLUG: "north-of-hell" },
  };
  const source = readFileSync(new URL("../../src/lib/supabase/admin-auth.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  runInNewContext(outputText, { module: authModule, exports: authModule.exports, require: (name: string) => {
    assert.ok(name in dependencies, `Unexpected import: ${name}`);
    return dependencies[name];
  }, process: { env: { NODE_ENV: "development" } }, console });
  return { login: authModule.exports.validateAdminLogin, clientsCreated: () => clientCount };
}

test("local email login checks administrator access with the signed-in client", async () => {
  const fixture = loginFixture();
  const user = await fixture.login("lasse@aparent.tv", "test-password");
  assert.equal(user?.id, "admin-id");
  assert.equal(user?.auth_source, "supabase");
  assert.equal(fixture.clientsCreated(), 1);
});

test("valid credentials without a project grant do not allow administrator access", async () => {
  const fixture = loginFixture({ authorized: false });
  assert.equal(await fixture.login("lasse@aparent.tv", "test-password"), null);
});

test("invalid credentials do not allow administrator access", async () => {
  const fixture = loginFixture({ passwordValid: false });
  assert.equal(await fixture.login("lasse@aparent.tv", "test-password"), null);
});
