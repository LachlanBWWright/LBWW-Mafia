import { expect, test } from "@playwright/test";

test("browser setup is disabled with an explanation and never contacts a companion", async ({
  page,
}) => {
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().includes("43117")) requests++;
  });
  await page.goto(
    "/iframe.html?id=features-ai-characters--browser-unavailable&viewMode=story",
  );
  await expect(
    page.getByRole("button", { name: "Add AI characters", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "ChatGPT AI characters are available in the desktop and mobile apps. Browser sign-in is not supported yet.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(requests).toBe(0);
});

test("declined plan permission retains identity and can be enabled explicitly", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=features-ai-characters--plan-disabled&viewMode=story",
  );
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("player@example.com", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("ChatGPT plan usage is off", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Add characters", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Enable ChatGPT plan usage", exact: true })
    .click();
  await expect(
    dialog.getByText("ChatGPT plan usage enabled", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Add characters", exact: true }),
  ).toBeEnabled();
});

test("AI character setup opens from a button and returns keyboard focus on close", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=features-ai-characters--setup&viewMode=story",
  );
  const trigger = page.getByRole("button", {
    name: "Add AI characters",
    exact: true,
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Add AI characters" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Continue with ChatGPT", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel(/key/i)).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Add characters", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("ChatGPT connects, loads models and disconnects without pasted keys", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=features-ai-characters--open&viewMode=story",
  );
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Continue with ChatGPT", exact: true })
    .click();
  await expect(
    dialog.getByText("ChatGPT plan usage enabled", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("combobox", { name: "ChatGPT model" }),
  ).toHaveValue("fixture-model");
  await expect(
    dialog.getByRole("button", { name: "Add characters", exact: true }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Continue with ChatGPT", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Add characters", exact: true }),
  ).toBeDisabled();
});

test("plan usage pause requires an explicit retry", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=features-ai-characters--usage-limit&viewMode=story",
  );
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Add characters", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Retry after checking usage", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Add characters", exact: true }),
  ).toBeEnabled();
  await expect(
    dialog.getByRole("link", { name: "Manage usage", exact: true }),
  ).toHaveAttribute("href", "https://chatgpt.com/settings/usage");
});
