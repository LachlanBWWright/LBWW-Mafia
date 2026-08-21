import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

export default async function prepareScreenshotDirectory() {
  const outputDirectory = path.resolve("storybook-screenshots");
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
}
