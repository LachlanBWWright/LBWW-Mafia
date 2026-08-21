import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "screenshots.spec.ts",
  fullyParallel: false,
  reporter: "line",
  projects: [
    { name: "small-phone", use: { viewport: { width: 320, height: 568 } } },
    { name: "phone", use: { viewport: { width: 390, height: 844 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
  ],
  use: {
    baseURL: "http://127.0.0.1:6010",
    browserName: "chromium",
    colorScheme: "dark",
    deviceScaleFactor: 1,
  },
});
