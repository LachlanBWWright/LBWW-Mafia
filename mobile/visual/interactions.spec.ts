import { expect, test, type Page } from "@playwright/test";

async function openHome(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "LBWW Mafia", exact: true })).toBeVisible();
}

test.describe("mobile navigation behavior", () => {
  test("Join Game opens the lobby with connection recovery actions", async ({ page }) => {
    await openHome(page);
    await page.getByText("Join Game", { exact: true }).click();

    await expect(page.getByText("Connection unavailable", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry connection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Practice match" })).toBeVisible();
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
