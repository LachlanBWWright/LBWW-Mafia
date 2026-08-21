import { defineConfig } from "@playwright/test";

export default defineConfig({
  globalSetup: "./screenshot-setup.ts",
  testDir: ".",
  testMatch: "screenshots.spec.ts",
  fullyParallel: false,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:6006",
    browserName: "chromium",
    colorScheme: "dark",
    viewport: { width: 1440, height: 900 },
  },
});
