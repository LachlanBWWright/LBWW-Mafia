import { expect, test } from "@playwright/test";
const story = (id: string) => `/iframe.html?id=${id}&viewMode=story`;
test("normal setup is ready and public listing can be configured", async ({
  page,
}) => {
  await page.goto(story("features-custom-lobby--role-pool"));
  await page.getByText("Advanced setup", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Normal", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Create lobby", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Lobby name")).toBeVisible();
});
test("party leaders can bring their party to the current room", async ({
  page,
}) => {
  await page.goto(story("features-party--leader"));
  await expect(
    page.getByRole("button", { name: "Bring party here" }),
  ).toBeVisible();
  await expect(page.getByText("Party lobby selected")).toBeVisible();
});
test("invitation shows lobby status and join action", async ({ page }) => {
  await page.goto(story("features-notifications--inbox"));
  await expect(
    page.getByText("Mira invited you to Friday game."),
  ).toBeVisible();
  await expect(page.getByText("Players (3/8) · Waiting")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Join", exact: true }),
  ).toBeEnabled();
});
test("community groups friends and incoming requests", async ({ page }) => {
  await page.goto(story("features-community--relationship-states"));
  await expect(
    page.getByRole("heading", { name: "Friends", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Friend requests", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Search results", exact: true }),
  ).toBeVisible();
});
