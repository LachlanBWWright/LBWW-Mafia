import { defineConfig } from "@playwright/test";

export default defineConfig({
  globalSetup: "./screenshot-setup.ts",
  testDir: ".",
  testMatch: "screenshots.spec.ts",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  updateSnapshots: process.env.STORYBOOK_UPDATE_SNAPSHOTS === "true" ? "all" : "none",
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
    },
  },
  reporter: process.env.CI
    ? [["line"], ["json", { outputFile: "test-results/storybook.json" }], ["html", { open: "never" }]]
    : "line",
  use: {
    baseURL: process.env.STORYBOOK_BASE_URL ?? "http://127.0.0.1:6006",
    browserName: "chromium",
    colorScheme: "dark",
    locale: "en-AU",
    timezoneId: "Australia/Sydney",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "small-phone", use: { viewport: { width: 320, height: 568 }, colorScheme: "dark" } },
    { name: "phone", use: { viewport: { width: 390, height: 844 }, colorScheme: "dark" } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 }, colorScheme: "dark" } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 }, colorScheme: "dark" } },
    { name: "small-phone-light", use: { viewport: { width: 320, height: 568 }, colorScheme: "light" } },
    { name: "phone-light", use: { viewport: { width: 390, height: 844 }, colorScheme: "light" } },
    { name: "tablet-light", use: { viewport: { width: 768, height: 1024 }, colorScheme: "light" } },
    { name: "desktop-light", use: { viewport: { width: 1440, height: 900 }, colorScheme: "light" } },
    { name: "phone-rtl", use: { viewport: { width: 390, height: 844 }, colorScheme: "dark", locale: "ar-AE" } },
    { name: "desktop-rtl", use: { viewport: { width: 1440, height: 900 }, colorScheme: "dark", locale: "ar-AE" } },
  ],
});
