import { expect, test, type Page } from "@playwright/test";

async function openHome(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "LBWW Mafia", exact: true }),
  ).toBeVisible();
}

test.describe("mobile navigation behavior", () => {
  test("Quick Join opens the lobby with connection recovery actions", async ({
    page,
  }) => {
    await openHome(page);
    await page.getByText("Quick Join", { exact: true }).click();

    await expect(
      page.getByText("Connection unavailable", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retry connection" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Practice match" }),
    ).toBeVisible();
  });

  test("public lobbies and create lobby retain navigation", async ({
    page,
  }) => {
    await page.route("**/api/lobbies?*", (route) =>
      route.fulfill({
        json: {
          lobbies: [
            {
              roomId: "public-room",
              name: "Friday game",
              players: 2,
              capacity: 8,
              status: "waiting",
            },
          ],
        },
      }),
    );
    await openHome(page);
    await page
      .getByRole("button", { name: "Public Lobbies", exact: true })
      .click();
    await expect(page.getByText("Friday game", { exact: true })).toBeVisible();
    await page.getByLabel("Search lobbies").fill("other");
    await expect(page.getByText("Friday game", { exact: true })).toHaveCount(0);
    await page.getByLabel("Search lobbies").fill("");
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page.getByRole("button", { name: "Joinable only: off" }).click();
    await expect(page.getByText("Friday game", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page
      .getByRole("button", { name: "Create Lobby", exact: true })
      .click();
    await expect(
      page.getByText("Sign in to create a lobby", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "LBWW Mafia", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("About", { exact: true })).toHaveCount(0);
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

    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(page.getByText("Roles", { exact: true })).toBeVisible();
    await expect(page.getByText("History", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Sign in", { exact: true }).last(),
    ).toBeVisible();
    await expect(
      page.getByText("Community", { exact: true }),
    ).not.toBeVisible();
    await expect(page.getByText("Messages", { exact: true })).not.toBeVisible();
  });
});
