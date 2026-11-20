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
    await page.goto(`/iframe.html?id=${story.id}&viewMode=story`, {
      waitUntil: "networkidle",
    });

    const isRtl = projectName.endsWith("rtl");
    const isLight = projectName.endsWith("light");
    // Init scripts run before documentElement exists. Apply the matrix after
    // navigation so every capture actually uses its requested theme/direction.
    await page.evaluate(
      ({ isRtl, isLight }) => {
        document.documentElement.dir = isRtl ? "rtl" : "ltr";
        document.documentElement.classList.toggle("light", isLight);
      },
      { isRtl, isLight },
    );
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      isRtl ? "rtl" : "ltr",
    );
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue("--background")
            .trim(),
        ),
      )
      .toBe(isLight ? "#f8fafc" : "#060912");

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

    if (
      story.id === "features-custom-lobby--custom-role" &&
      page.viewportSize()!.width < 640
    ) {
      const authoredRole = page.getByRole("listitem").filter({
        has: page.getByRole("button", {
          name: "Edit Field Medic",
          exact: true,
        }),
      });
      const description = authoredRole.locator(":scope > div").first();
      const descriptionWidth = await description.evaluate(
        (element) => element.getBoundingClientRect().width,
      );
      const rowWidth = await authoredRole.evaluate(
        (element) => element.getBoundingClientRect().width,
      );
      expect(descriptionWidth).toBeGreaterThanOrEqual(rowWidth - 1);
    }

    // Run the full accessibility scan once per story and theme. Remaining projects
    // focus on visual differences across viewport/theme/direction matrices.
    if (projectName === "desktop" || projectName === "desktop-light") {
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
