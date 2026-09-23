// An isolated, disposable local review. No real Supabase credentials or data are used.
import { spawn } from "node:child_process";
for (const url of [
  "http://127.0.0.1:54329/health",
  "http://127.0.0.1:3100/admin/keynote/login",
]) {
  let occupied = false;
  try {
    await fetch(url, { signal: AbortSignal.timeout(1000) });
    occupied = true;
  } catch {}
  if (occupied)
    throw new Error(
      "Review ports 3100/54329 are occupied. Stop that review or test run first.",
    );
}
const children = [];
const stop = () => {
  for (const child of children) child.kill("SIGTERM");
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", stop);
function run(args, env = process.env) {
  const child = spawn(process.execPath, args, { stdio: "inherit", env });
  children.push(child);
  child.on("exit", (code) => {
    if (code) {
      stop();
      process.exitCode = code;
    }
  });
  return child;
}
run(["--import", "tsx", "tests/keynote/fixture-server.ts"]);
let ready = false;
for (let i = 0; i < 30; i++) {
  try {
    const response = await fetch("http://127.0.0.1:54329/health");
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!ready) {
  stop();
  throw new Error("Local review database did not start.");
}
run(
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  {
    ...process.env,
    KEYNOTE_TEST_DIST_DIR: ".next-keynote-test",
    KEYNOTE_SUPABASE_URL: "http://127.0.0.1:54329",
    KEYNOTE_SUPABASE_PUBLISHABLE_KEY: "local-anon-test-key",
    KEYNOTE_SUPABASE_SERVER_KEY: "local-service-test-key",
    KEYNOTE_PUBLISHED_SOURCE: "database",
    KEYNOTE_REVIEW_MODE: "local",
  },
);
console.log(
  "\nLocal keynote review: http://127.0.0.1:3100/admin/keynote\nAccount: editor@example.test / local-test-only-password\nData is disposable and resets when this process restarts.\n",
);
