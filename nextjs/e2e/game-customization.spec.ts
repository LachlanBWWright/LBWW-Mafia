import { test, expect } from "@playwright/test";

test("create lobby retains navigation to the home page", async ({ page }) => {
  await page.goto("/lobby/create");
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "LBWW Mafia" })).toBeVisible();
});

test("custom rules and custom role survive a game-pack round trip", async ({
  page,
}) => {
  await page.goto("/lobby/create");
  await page.getByText("Advanced setup", { exact: true }).click();
  await page
    .getByRole("button", { name: "Weighted random", exact: true })
    .click();
  await page.getByLabel("Doctor", { exact: true }).check();
  await page.getByLabel("Mafia", { exact: true }).check();
  await page.getByLabel("Day duration (seconds)").fill("120");
  await page
    .getByText("Information and communication", { exact: true })
    .click();
  await page.getByLabel("Death reveals").selectOption("none");
  await page.getByText("Custom roles and variants", { exact: true }).click();
  await page
    .getByRole("button", { name: "Add custom role", exact: true })
    .click();
  await page.getByText("Import and share a game pack", { exact: true }).click();
  await page.getByLabel("Pack name", { exact: true }).fill("Night school");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const document = await page
    .getByLabel("Pack JSON or share link")
    .inputValue();
  expect(JSON.parse(document)).toMatchObject({
    version: 1,
    name: "Night school",
    config: {
      rules: { timing: { daySeconds: 120 }, reveal: { onDeath: "none" } },
      customRoles: [{ id: "field-medic", charges: 2, noRepeatTarget: true }],
    },
  });
  await page.getByLabel("Day duration (seconds)").fill("60");
  await page.getByRole("button", { name: "Import pack", exact: true }).click();
  await expect(page.getByLabel("Day duration (seconds)")).toHaveValue("120");
  await expect(page.getByLabel("Death reveals")).toHaveValue("none");
  await expect(page.getByLabel("Setup summary")).toContainText(
    "Hidden death information",
  );
  await page
    .getByRole("button", { name: "Create share link", exact: true })
    .click();
  const link = await page.getByLabel("Pack JSON or share link").inputValue();
  await page.goto("about:blank");
  await page.goto(link);
  await page.getByText("Advanced setup", { exact: true }).click();
  await page.getByText("Import and share a game pack", { exact: true }).click();
  await page
    .getByRole("button", { name: "Load pack from link", exact: true })
    .click();
  await expect(page.getByLabel("Day duration (seconds)")).toHaveValue("120");
  await expect(page.getByLabel("Setup summary")).toContainText(
    "1 custom roles",
  );
});

test("invalid and future game packs leave the setup intact", async ({
  page,
}) => {
  await page.goto("/lobby/create");
  await page.getByText("Advanced setup", { exact: true }).click();
  await page.getByText("Import and share a game pack", { exact: true }).click();
  await page.getByLabel("Pack JSON or share link").fill("{bad");
  await page.getByRole("button", { name: "Import pack", exact: true }).click();
  await expect(page.getByText("Game pack is not valid JSON.")).toBeVisible();
  await expect(page.getByLabel("Players", { exact: true })).toHaveValue("8");
});

test("importing an explicit roster preserves ability restrictions and hidden rules", async ({
  page,
}) => {
  const pack = {
    format: "lbww-mafia",
    version: 1,
    name: "Quiet clinic",
    config: {
      size: 2,
      voteVisibility: "hidden",
      roleSelection: {
        algorithm: "explicit-slots",
        roles: [],
        explicitSlots: ["custom:clinic-medic", "mafia"],
      },
      customRoles: [
        {
          id: "clinic-medic",
          name: "Clinic Medic",
          description: "Protect the village",
          alignment: "town",
          effect: "protect",
          target: "any",
          charges: 3,
          cooldownNights: 2,
          noRepeatTarget: true,
        },
      ],
      rules: {
        timing: { daySeconds: 135, nightSeconds: 40, earlyEnd: false },
        reveal: { onDeath: "faction" },
        voting: { method: "plurality", tie: "random", allowRevote: false },
      },
    },
  };
  await page.goto("/lobby/create");
  await page.getByText("Advanced setup", { exact: true }).click();
  await page.getByText("Import and share a game pack", { exact: true }).click();
  await page.getByLabel("Pack JSON or share link").fill(JSON.stringify(pack));
  await page.getByRole("button", { name: "Import pack", exact: true }).click();
  await expect(page.getByLabel("Players", { exact: true })).toHaveValue("2");
  await expect(page.getByLabel("Role slots", { exact: true })).toHaveValue(
    "custom:clinic-medic, mafia",
  );
  await expect(page.getByLabel("Votes", { exact: true })).toHaveValue("hidden");
  await expect(page.getByLabel("Day duration (seconds)")).toHaveValue("135");
  await page.getByText("Custom roles and variants", { exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Clinic Medic", exact: true })
    .click();
  await expect(page.getByLabel("Role ID", { exact: true })).toHaveValue(
    "clinic-medic",
  );
  await expect(page.getByLabel("Ability uses (blank = unlimited)")).toHaveValue(
    "3",
  );
  await expect(page.getByLabel("Cooldown nights")).toHaveValue("2");
  await page.getByRole("button", { name: "Save role", exact: true }).click();
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const exported = JSON.parse(
    await page.getByLabel("Pack JSON or share link").inputValue(),
  ) as unknown;
  expect(exported).toMatchObject(pack);
});

test("signed-out preset controls offer sign-in without blocking local game packs", async ({
  page,
}) => {
  await page.goto("/lobby/create");
  await page.getByText("Advanced setup", { exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Sign in to save and load presets" }),
  ).toHaveAttribute("href", "/signin?callbackUrl=%2Flobby%2Fcreate", {
    timeout: 20_000,
  });
  await page.getByLabel("Preset name", { exact: true }).fill("My rules");
  await expect(
    page.getByRole("button", { name: "Save current rules" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Unable to load saved presets.", { exact: true }),
  ).toHaveCount(0);
  await page.getByText("Import and share a game pack", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Export JSON", exact: true }),
  ).toBeEnabled();
});

test("role sandbox resolves the configured ability and targeting restrictions", async ({
  page,
}) => {
  await page.goto("/sandbox");
  await page.getByLabel("Incoming attack").uncheck();
  await page.getByRole("button", { name: "Run scenario", exact: true }).click();
  const results = page.getByRole("region", { name: "Scenario results" });
  await expect(results).toBeVisible();
  await expect(results).toContainText("Night 1: Action accepted");
  await expect(results).toContainText("Night 2: Action rejected");
  await expect(results).toContainText("Night 3: Action accepted");
});
