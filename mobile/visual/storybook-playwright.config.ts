import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "storybook-screenshots.spec.ts",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  updateSnapshots: process.env.STORYBOOK_UPDATE_SNAPSHOTS === "true" ? "all" : "none",
  expect: {
    timeout: 30_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
    },
  },
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }], ["json", { outputFile: "test-results/storybook.json" }]]
    : "line",
  use: {
    baseURL: process.env.STORYBOOK_BASE_URL ?? "http://127.0.0.1:6011",
    browserName: "chromium",
    deviceScaleFactor: 1,
    locale: "en-AU",
    timezoneId: "Australia/Sydney",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "small-phone-dark", use: { viewport: { width: 320, height: 568 }, colorScheme: "dark" } },
    { name: "phone-dark", use: { viewport: { width: 390, height: 844 }, colorScheme: "dark" } },
    { name: "tablet-dark", use: { viewport: { width: 768, height: 1024 }, colorScheme: "dark" } },
    { name: "small-phone-light", use: { viewport: { width: 320, height: 568 }, colorScheme: "light" } },
    { name: "phone-light", use: { viewport: { width: 390, height: 844 }, colorScheme: "light" } },
    { name: "tablet-light", use: { viewport: { width: 768, height: 1024 }, colorScheme: "light" } },
  ],
});
