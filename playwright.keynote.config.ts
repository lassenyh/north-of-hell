import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/keynote",
  testMatch: "*.spec.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL: "http://127.0.0.1:3100",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath:
        process.env.KEYNOTE_TEST_BROWSER ||
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    },
  },
  webServer: [
    {
      command: "node --import tsx tests/keynote/fixture-server.ts",
      url: "http://127.0.0.1:54329/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100/admin/keynote/login",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        KEYNOTE_TEST_DIST_DIR: ".next-keynote-test",
        KEYNOTE_SUPABASE_URL: "http://127.0.0.1:54329",
        KEYNOTE_SUPABASE_PUBLISHABLE_KEY: "local-anon-test-key",
        KEYNOTE_SUPABASE_SERVER_KEY: "local-service-test-key",
        KEYNOTE_PUBLISHED_SOURCE: "database",
      },
    },
  ],
});
