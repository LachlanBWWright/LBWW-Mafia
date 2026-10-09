import { expect, test, type Page } from "@playwright/test";

async function openHome(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Quick Start", { exact: true })).toBeVisible();
}

test.describe("mobile navigation behavior", () => {
  test("Join Game opens the lobby connection state", async ({ page }) => {
    await openHome(page);
    await page.getByText("Join Game", { exact: true }).click();

    await expect(page.getByText("Connecting to Game Lobby")).toBeVisible();
  });

  test("signed-out users are sent to sign in for Create Lobby", async ({
    page,
  }) => {
    await openHome(page);
    await page.getByText("Create Lobby", { exact: true }).click();
    await page.getByText("Sign in to create a lobby", { exact: true }).click();

    await expect(page.getByText("Continue with Google")).toBeVisible();
  });

  test("signed-out navigation exposes public routes and sign-in", async ({
    page,
  }) => {
    await openHome(page);

    await expect(page.getByText("Roles", { exact: true })).toBeVisible();
    await expect(page.getByText("History", { exact: true })).toBeVisible();
    await expect(page.getByText("Sign in", { exact: true }).last()).toBeVisible();
    await expect(page.getByText("Community", { exact: true })).not.toBeVisible();
    await expect(page.getByText("Messages", { exact: true })).not.toBeVisible();
  });
});
