import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

type StoryIndex = {
  entries: Record<string, { id: string; type: "story" | "docs" }>;
};

const storyIndex = JSON.parse(
  await readFile(path.resolve("storybook-static/index.json"), "utf8"),
) as StoryIndex;

const stories = Object.values(storyIndex.entries)
  .filter((entry) => entry.type === "story")
  .sort((left, right) => left.id.localeCompare(right.id));

for (const story of stories) {
  test(`render and capture ${story.id}`, async ({ page }) => {
    const projectName = test.info().project.name;
    if (projectName.endsWith("rtl") || projectName.endsWith("light")) {
      await page.addInitScript(
        ({ isRtl, isLight }) => {
          if (isRtl) document.documentElement.dir = "rtl";
          if (isLight) document.documentElement.classList.add("light");
        },
        {
          isRtl: projectName.endsWith("rtl"),
          isLight: projectName.endsWith("light"),
        },
      );
    }
    await page.goto(`/iframe.html?id=${story.id}&viewMode=story`, {
      waitUntil: "networkidle",
    });

    const root = page.locator("#storybook-root");
    await expect(root).toBeVisible();
    await expect(root.locator(":scope > *").first()).toBeVisible();
    await expect(page.locator("#error-message")).toBeHidden();
    // Storybook play functions must finish before capturing their resulting state.
    await page.waitForFunction(() => {
      const preview = (
        window as unknown as {
          __STORYBOOK_PREVIEW__?: { storyRenders: { phase: string }[] };
        }
      ).__STORYBOOK_PREVIEW__;
      return preview?.storyRenders.some(
        (render) => render.phase === "finished",
      );
    });
    await page.evaluate(() => document.fonts.ready);

    // Run the full accessibility scan once per story. The remaining projects
    // focus on visual differences across viewport/theme/direction matrices.
    if (projectName === "desktop") {
      const accessibility = await new AxeBuilder({ page })
        .include("#storybook-root")
        .analyze();
      expect(accessibility.violations).toEqual([]);
    }

    const screenshotPath = path.join(
      "storybook-screenshots",
      projectName,
      `${story.id}.png`,
    );
    await mkdir(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      animations: "disabled",
    });
    await expect(page).toHaveScreenshot([projectName, `${story.id}.png`], {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
    });
  });
}
