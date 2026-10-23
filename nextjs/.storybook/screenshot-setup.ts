import { mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import type { FullConfig } from "@playwright/test";

export default async function prepareScreenshotDirectory(config: FullConfig) {
  // Missing fixtures are a setup failure, not hundreds of retried screenshots.
  if (process.env.STORYBOOK_UPDATE_SNAPSHOTS !== "true") {
    execFileSync(process.execPath, [
      "../scripts/check-storybook-screenshot-coverage.mjs",
      "storybook-static/index.json",
      ".storybook/screenshots.spec.ts-snapshots",
      ...config.projects.map((project) => project.name),
    ], { stdio: "inherit" });
  }
  const outputDirectory = path.resolve("storybook-screenshots");
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
}
