import { expect, test } from "@playwright/test";

test("authenticated routes preserve the sign-in boundary", async ({ page }) => {
  await page.goto("/messages", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByText("Sign in", { exact: true }).first()).toBeVisible();
});

test("invalid lobby links still produce a playable lobby", async ({ page }) => {
  await page.goto("/lobby?room=cross-browser-invalid", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByLabel("Assigned player name")).toContainText(
    "You joined as",
  );
  await expect(page.getByText(/Day \d+|Night/, { exact: false }).first()).toBeVisible();
});
