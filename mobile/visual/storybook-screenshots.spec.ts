import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { storybookStories } from "./storybook-stories.mjs";

for (const story of storybookStories) {
  test(`render and compare ${story.id}`, async ({ page }, testInfo) => {
    await page.goto(`/?capture=${encodeURIComponent(story.id)}`, {
      waitUntil: "networkidle",
    });
    await expect(
      page.getByText(story.readyText, { exact: false }).first(),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const projectName = testInfo.project.name;
    const output = path.join(
      "visual",
      "storybook-screenshots",
      projectName,
      `${story.name}.png`,
    );
    await mkdir(path.dirname(output), { recursive: true });
    await page.screenshot({
      path: output,
      fullPage: true,
      animations: "disabled",
    });
    await expect(page).toHaveScreenshot([projectName, `${story.name}.png`], {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
    });
  });
}

test("custom lobby controls validate pool limits and explicit slots", async ({
  page,
}) => {
  await page.goto("/?capture=mobile-ui-kit--custom-lobby", {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "Doctor", exact: true }).click();
  await expect(page.getByLabel("Doctor weight", { exact: true })).toBeVisible();
  await page.getByLabel("Doctor minimum", { exact: true }).fill("9");
  await page.getByRole("button", { name: "Create lobby", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("minimum exceeds");
  await page
    .getByRole("button", { name: "Explicit slots", exact: true })
    .click();
  await expect(page.getByLabel("Role slots", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Doctor weight", { exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("Players", { exact: true }).fill("2");
  await page.getByLabel("Role slots", { exact: true }).fill("doctor, mafia");
  await page.getByRole("button", { name: "Create lobby", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("message reports retain context and validate incident details", async ({
  page,
}) => {
  await page.goto("/?capture=mobile-ui-kit--message-history", {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "Report", exact: true }).click();
  await expect(page.getByLabel("Message ID (optional)")).toHaveValue("1");
  await page.getByLabel("Report details").fill("Short");
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await expect(
    page.getByText("Describe what happened in at least 10 characters."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Report details")).toBeHidden();
});

test("privacy account deletion requires explicit confirmation", async ({
  page,
}, testInfo) => {
  await page.goto("/?capture=mobile-ui-kit--account-privacy", {
    waitUntil: "networkidle",
  });
  const remove = page.getByRole("button", {
    name: "Delete account",
    exact: true,
  });
  await remove.scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Export account data", exact: true }),
  ).toBeVisible();
  await expect(remove).toBeDisabled();
  await page.getByLabel("Delete account confirmation").fill("delete");
  await expect(remove).toBeDisabled();
  await page.getByLabel("Delete account confirmation").fill("DELETE");
  await expect(remove).toBeEnabled();
  await remove.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  const project = testInfo.project.name;
  const output = path.join(
    "visual",
    "storybook-screenshots",
    project,
    "account-deletion-confirmation.png",
  );
  await mkdir(path.dirname(output), { recursive: true });
  await page.screenshot({
    path: output,
    animations: "disabled",
    caret: "hide",
  });
  await expect(page).toHaveScreenshot(
    [project, "account-deletion-confirmation.png"],
    { animations: "disabled", caret: "hide" },
  );
});
