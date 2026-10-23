import { expect, test } from "@playwright/test";

test("authenticated routes preserve the sign-in boundary", async ({ page }) => {
  await page.goto("/messages", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByText("Sign in", { exact: true }).first()).toBeVisible();
});

test("invalid lobby links still produce a playable lobby", async ({ page }) => {
  await page.goto("/lobby?room=invalid%2Froom", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByLabel("Your player name")).not.toBeEmpty();
  await expect(page.getByRole("heading", {
    name: /^(Waiting for players|Day \d+|Night \d+)$/,
  }).first()).toBeVisible();
});
