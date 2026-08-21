import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

type StoryIndex = {
  entries: Record<string, { id: string; type: "story" | "docs" }>;
};

const storyIndex = JSON.parse(
  readFileSync(path.resolve("storybook-static/index.json"), "utf8"),
) as StoryIndex;

const stories = Object.values(storyIndex.entries)
  .filter((entry) => entry.type === "story")
  .sort((left, right) => left.id.localeCompare(right.id));

for (const story of stories) {
  test(`render and capture ${story.id}`, async ({ page }) => {
    await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);

    const root = page.locator("#storybook-root");
    await expect(root).toBeVisible();
    await expect(root.locator(":scope > *").first()).toBeVisible();
    await expect(page.locator("#error-message")).toBeHidden();
    await page.evaluate(() => document.fonts.ready);

    await page.screenshot({
      path: path.join("storybook-screenshots", `${story.id}.png`),
      fullPage: true,
      animations: "disabled",
    });
  });
}
