import { expect, test } from "@playwright/test";
test("public lobby directory filters and loads more rooms", async ({
  page,
}) => {
  await page.route("**/api/lobbies?*", (route) => {
    const offset = new URL(route.request().url()).searchParams.get("offset");
    return route.fulfill({
      json:
        offset === "50"
          ? {
              lobbies: [
                {
                  roomId: "second",
                  name: "Late game",
                  players: 2,
                  capacity: 8,
                  status: "waiting",
                },
              ],
              nextOffset: null,
            }
          : {
              lobbies: [
                {
                  roomId: "first",
                  name: "Friday game",
                  players: 3,
                  capacity: 8,
                  status: "waiting",
                },
                {
                  roomId: "started",
                  name: "Started game",
                  players: 8,
                  capacity: 8,
                  status: "in-progress",
                },
              ],
              nextOffset: 50,
            },
    });
  });
  await page.goto("/lobbies");
  await expect(page.getByText("Friday game")).toBeVisible();
  await page.getByLabel("Joinable only").check();
  await expect(page.getByText("Started game")).toHaveCount(0);
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.getByText("Late game")).toBeVisible();
  await page.getByLabel("Search lobbies").fill("Friday");
  await expect(page.getByText("Late game")).toHaveCount(0);
});
