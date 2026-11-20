import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import path from "node:path";

export default defineConfig({
  testDir: "./e2e",
  // Videos and traces are written continuously; keeping them outside the
  // source tree prevents Next's development watcher from reloading the app.
  outputDir:
    process.env.PLAYWRIGHT_OUTPUT_DIR ??
    path.join(tmpdir(), "lbww-mafia-playwright-results"),
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [
        ["line"],
        ["json", { outputFile: "playwright-report/results.json" }],
        ["html", { open: "never" }],
      ]
    : "line",
  use: {
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    colorScheme: "dark",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "bash ../scripts/playwright-server.sh",
    url: "http://127.0.0.1:3100/api/matchmaking/current",
    timeout: 120_000,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 15_000 },
    stdout: "pipe",
    stderr: "pipe",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["iPhone 13"] } },
  ],
});
