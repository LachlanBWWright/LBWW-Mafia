import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["screenshots.spec.ts", "interactions.spec.ts"],
  fullyParallel: false,
  workers: Number(process.env.VISUAL_TEST_WORKERS ?? 2),
  retries: process.env.CI ? 1 : 0,
  updateSnapshots: process.env.VISUAL_UPDATE_SNAPSHOTS === "true" ? "all" : "none",
  reporter: process.env.CI
    ? [["line"], ["json", { outputFile: "test-results/mobile-visual.json" }]]
    : "line",
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
    },
  },
  projects: [
    { name: "small-phone", use: { viewport: { width: 320, height: 568 }, colorScheme: "dark" } },
    { name: "phone", use: { viewport: { width: 390, height: 844 }, colorScheme: "dark" } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 }, colorScheme: "dark" } },
    { name: "small-phone-light", use: { viewport: { width: 320, height: 568 }, colorScheme: "light" } },
    { name: "phone-light", use: { viewport: { width: 390, height: 844 }, colorScheme: "light" } },
    { name: "tablet-light", use: { viewport: { width: 768, height: 1024 }, colorScheme: "light" } },
  ],
  use: {
    baseURL: process.env.VISUAL_BASE_URL ?? "http://127.0.0.1:6010",
    browserName: "chromium",
    colorScheme: "dark",
    deviceScaleFactor: 1,
    locale: "en-AU",
    timezoneId: "Australia/Sydney",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
