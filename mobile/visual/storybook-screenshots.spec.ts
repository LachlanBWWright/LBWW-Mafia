import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { storybookStories } from "./storybook-stories.mjs";

test("chat announcements distinguish phase changes, deaths, results and outcome", async ({ page }) => {
  await page.goto("/?capture=mobile-ui-kit--match-chat-announcements", { waitUntil: "networkidle" });
  for (const event of ["phase-day", "phase-night", "death", "result", "outcome"]) {
    await expect(page.getByTestId(`chat-event-${event}`).first()).toHaveCount(1);
  }
  await expect(page.getByText("Theo has voted for Nadia.", { exact: true })).toHaveCount(1);
});

test("game chat suggests and inserts roles and player names", async ({ page }) => {
  await page.goto("/?capture=mobile-ui-kit--match-night", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  const message = page.getByLabel("Message", { exact: true });
  await message.fill("/do");
  await expect(page.getByRole("button", { name: "Doctor, Role" })).toBeVisible();
  await page.getByRole("button", { name: "Doctor, Role" }).focus();
  await page.waitForTimeout(200);
  await expect(page.getByRole("button", { name: "Doctor, Role" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(message).toHaveValue("Doctor ");
  await message.fill("/th");
  await expect(page.getByRole("button", { name: "Theo, Player" })).toBeVisible();
  await page.getByRole("button", { name: "Theo, Player" }).click();
  await expect(message).toHaveValue("Theo ");
});

test("chat player links lead to private notes and role reference", async ({ page }) => {
  await page.goto("/?capture=mobile-ui-kit--match-interactive-ux", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page.getByRole("button", { name: "Show player Theo" }).click();
  await page.getByRole("button", { name: "Add private note for Theo" }).click();
  const claim = page.getByLabel("Claim for Theo", { exact: true });
  await expect(claim).toBeVisible();
  await claim.fill("Doctor");
  await expect(page.getByRole("button", { name: "Edit private note for Theo" })).toBeVisible();
  await page.getByRole("button", { name: "Your role: Doctor", exact: true }).first().click();
  await expect(page.getByText("Help Town eliminate Mafia and other hostile factions.")).toBeVisible();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page.getByRole("button", { name: "Your role: Doctor", exact: true }).first().click();
  await page.getByRole("button", { name: "Back to chat", exact: true }).click();
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
});

test("chat offers a jump to new messages after scrolling up", async ({ page }) => {
  await page.goto("/?capture=mobile-ui-kit--match-unread-chat", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  const chat = page.getByLabel("Game chat", { exact: true });
  await expect(chat.getByText("Message 40", { exact: true })).toBeVisible();
  await expect.poll(() => chat.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeLessThan(80);
  await chat.evaluate((element) => { element.scrollTop = 0; element.dispatchEvent(new Event("scroll")); });
  await expect.poll(() => chat.evaluate((element) => element.scrollTop)).toBe(0);
  await page.waitForTimeout(150); // React Native throttles scroll notifications.
  await page.getByLabel("Message", { exact: true }).fill("New message");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "1 new message ↓" })).toBeVisible();
  await page.getByRole("button", { name: "Players", exact: true }).click();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(page.getByRole("button", { name: "1 new message ↓" })).toBeVisible();
  await expect.poll(() => chat.evaluate((element) => element.scrollTop)).toBe(0);
  await page.getByRole("button", { name: "1 new message ↓" }).click();
  await expect(page.getByRole("button", { name: "1 new message ↓" })).toHaveCount(0);
});

test("features-private-notes--match saves a private board locally and clears it", async ({
  page,
}) => {
  await page.goto("/?capture=features-private-notes--match", {
    waitUntil: "networkidle",
  });
  const notes = page.getByLabel("Match notes", { exact: true });
  await expect(notes).toBeEnabled();
  await notes.fill("Bob's claim changed after the vote.");
  await page.getByLabel("Claim for Bob", { exact: true }).fill("Doctor");
  await page
    .getByRole("button", { name: "Suspicious: Bob", exact: true })
    .click();
  await expect(
    page.getByText("Saved on this device.", { exact: true }),
  ).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(notes).toHaveValue("Bob's claim changed after the vote.");
  await expect(page.getByLabel("Claim for Bob", { exact: true })).toHaveValue(
    "Doctor",
  );
  await page.getByRole("button", { name: "Clear notes", exact: true }).click();
  await expect(page.getByText("Notes cleared.", { exact: true })).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(notes).toHaveValue("");
  await expect(page.getByLabel("Claim for Bob", { exact: true })).toHaveValue(
    "",
  );
});

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
  await page.getByRole("button", { name: "Advanced setup +" }).click();
  await expect(
    page.getByRole("button", { name: "Normal", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Create lobby", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Weighted random", exact: true })
    .click();
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

test("mobile-ui-kit--match-practice teaches protection, voting, and replay", async ({
  page,
}) => {
  await page.goto("/?capture=mobile-ui-kit--match-practice");
  await expect(page.getByText("Night 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Mafia", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Choose who to protect", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Players", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^(Protect|Visit|Investigate) Mira$/, exact: true }).click();
  await expect(
    page.getByText("Protection selected: Mira.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel action", exact: true })
    .click();
  await expect(
    page.getByText("Night action cancelled.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue to day", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /^(Protect|Visit|Investigate) Mira$/, exact: true }).click();
  await page
    .getByRole("button", { name: "Continue to day", exact: true })
    .click();
  await expect(page.getByText("Day 2", { exact: true })).toBeVisible();
  await expect(page.getByTestId("phase-announcement")).toHaveText("Day 2 begins");
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(page.getByLabel("Game chat")).toContainText(
    "I saw Theo near my house",
  );
  const message = page.getByLabel("Message", { exact: true });
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeDisabled();
  await message.fill("Mira, thank you for the clue.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(message).toHaveValue("");
  await expect(
    page.getByLabel("Game chat").getByText("You", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Game chat")).toContainText(
    "Mira, thank you for the clue.",
  );
  await page.getByRole("button", { name: "Players", exact: true }).click();
  await page
    .getByRole("button", { name: "Vote for Theo", exact: true })
    .click();
  await expect(page.getByText("Town wins", { exact: true })).toBeVisible();
  await expect(page.getByText("Mafia", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("button", { name: "Match timeline +", exact: true })
    .click();
  await expect(
    page.getByText("Day 2 · You voted for Theo.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play again", exact: true }).click();
  await expect(page.getByText("Night 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Mafia", { exact: true })).toHaveCount(0);
});

test("features-ai-characters plan permission can be enabled after declining", async ({
  page,
}) => {
  await page.goto("/?capture=features-ai-characters--plan-disabled");
  await expect(
    page.getByText("player@example.com", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("ChatGPT plan usage is off", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add characters", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Enable ChatGPT plan usage", exact: true })
    .click();
  await expect(
    page.getByText("ChatGPT plan usage enabled", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add characters", exact: true }),
  ).toBeEnabled();
});

test("features-ai-characters subscription connection needs no pasted keys", async ({
  page,
}) => {
  await page.goto("/?capture=features-ai-characters--setup", {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("button", { name: "Continue with ChatGPT", exact: true })
    .click();
  await expect(
    page.getByText("ChatGPT plan usage enabled", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add characters", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel(/pairing key|api key/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Continue with ChatGPT", exact: true }),
  ).toBeVisible();
});

async function expectNoHorizontalOverflow(
  page: import("@playwright/test").Page,
) {
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width + 1);
}

test("production match tabs expose selection, role details, and bot mute", async ({
  page,
}) => {
  await page.goto("/?capture=mobile-ui-kit--match-night", {
    waitUntil: "networkidle",
  });
  const players = page.getByRole("button", { name: "Players", exact: true });
  const chat = page.getByRole("button", { name: "Chat", exact: true });
  await expect(players).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("timer")).toHaveText("0:18");
  await expect(
    page.getByRole("button", { name: /^(Protect|Visit|Investigate) Mira$/, exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /^(Protect|Visit|Investigate) Sam$/, exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /^(Protect|Visit|Investigate) Theo$/, exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Cancel action", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByText(
      "Night action selected: Theo. You can change it until dawn.",
      { exact: true },
    ),
  ).toBeInViewport();
  const role = page.getByRole("button", {
    name: "Your role: Doctor +",
    exact: true,
  });
  await expect(role).toHaveAttribute("aria-expanded", "false");
  await role.click();
  await expect(
    page.getByRole("button", { name: "Your role: Doctor −", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await expectNoHorizontalOverflow(page);
  await chat.click();
  await expect(chat).toHaveAttribute("aria-pressed", "true");
  await expect(players).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: /^(Protect|Visit|Investigate) Theo$/, exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Game chat")).toContainText(
    "Let's compare our votes.",
  );
  await expect(
    page.getByRole("button", { name: "Mute bots", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Game chat")).toContainText(
    "Who did you watch last night?",
  );
  await expectNoHorizontalOverflow(page);
});

test("production voting preserves your submitted vote and public totals", async ({
  page,
}) => {
  await page.goto("/?capture=mobile-ui-kit--match-voting", {
    waitUntil: "networkidle",
  });
  await expect(
    page.getByText("Your vote: Theo", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("2 votes / 2 needed · Leading", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Voted for Theo/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Vote for Theo", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Vote for Nadia", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Abstain", exact: true }),
  ).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("production hidden voting reveals your choice without public vote metadata", async ({
  page,
}) => {
  await page.goto("/?capture=mobile-ui-kit--match-hidden-votes", {
    waitUntil: "networkidle",
  });
  await expect(page.getByText("Votes hidden", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Your vote: Theo", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Voted for Theo|Not voted|Abstained|Leading|votes to eliminate/,
    ),
  ).toHaveCount(0);
  await expect(page.getByText(/^\d+ votes?$/)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("production reconnect pauses action, cancellation, and chat submission", async ({
  page,
}) => {
  await page.goto("/?capture=mobile-ui-kit--match-reconnecting", {
    waitUntil: "networkidle",
  });
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Reconnecting… Actions are paused." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^(Protect|Visit|Investigate) Theo$/, exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /^(Protect|Visit|Investigate) Nadia$/, exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Cancel action", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(page.getByLabel("Message", { exact: true })).not.toBeEditable();
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeDisabled();
  await expectNoHorizontalOverflow(page);
});

test("production recap exposes timeline and lets players return to match chat", async ({
  page,
}) => {
  await page.goto("/?capture=mobile-ui-kit--match-recap", {
    waitUntil: "networkidle",
  });
  await expect(page.getByText("Town wins", { exact: true })).toBeVisible();
  await expect(page.getByText("1/4 ready", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play again", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Cancel action", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Your vote: Theo", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Match timeline +", exact: true })
    .click();
  await expect(
    page.getByText("Day 3 · Nadia was voted out (Mafia).", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Match timeline −", exact: true })
    .click();
  await expect(
    page.getByText("Day 3 · Nadia was voted out (Mafia).", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(page.getByLabel("Game chat")).toBeVisible();
  await expect(page.getByLabel("Message", { exact: true })).not.toBeEditable();
  await page.getByRole("button", { name: "Players", exact: true }).click();
  await expect(page.getByText("Town wins", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("waiting room shows capacity and AI controls", async ({ page }) => {
  await page.goto("/?capture=mobile-ui-kit--match-waiting");
  await page.getByRole("button", { name: "Players", exact: true }).click();
  await expect(page.getByText("Players (4/8)", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Share lobby", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Add AI characters/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mute bots", exact: true }),
  ).toHaveCount(0);
});

test("production home keeps lobby entry accessible", async ({ page }) => {
  await page.goto("/?capture=screens-home--landing", {
    waitUntil: "networkidle",
  });
  await expect(page.getByText("LBWW Mafia", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Example discussion", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Quick Join", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Create Lobby", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Public Lobbies", exact: true }),
  ).toBeEnabled();
  await expectNoHorizontalOverflow(page);
});

test("game packs export, validate versions and restore portable rules", async ({
  page,
}) => {
  await page.goto("/?capture=game-customization--packs", {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "Export pack", exact: true }).click();
  const input = page.getByLabel("Game pack JSON", { exact: true });
  const pack = JSON.parse(await input.inputValue());
  expect(pack.format).toBe("lbww-mafia");
  expect(pack.version).toBe(1);
  pack.version = 99;
  await input.fill(JSON.stringify(pack));
  await page.getByRole("button", { name: "Import pack", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  pack.version = 1;
  pack.name = "Friday night";
  await input.fill(JSON.stringify(pack));
  await page.getByRole("button", { name: "Import pack", exact: true }).click();
  await expect(page.getByLabel("Game pack name", { exact: true })).toHaveValue(
    "Friday night",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("custom roles reject duplicate identifiers and support investigation variants", async ({
  page,
}) => {
  await page.goto("/?capture=game-customization--custom-roles", {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("button", { name: "Add custom role", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("unique role ID");
  await page.getByLabel("Role ID", { exact: true }).fill("detective");
  await page.getByLabel("Role name", { exact: true }).fill("Detective");
  await page.getByRole("button", { name: "investigate", exact: true }).click();
  await page.getByLabel("Investigation accuracy", { exact: true }).fill("75");
  await page
    .getByRole("button", { name: "Add custom role", exact: true })
    .click();
  await expect(
    page.getByText("Detective: town, investigate at night", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove Detective", exact: true })
    .click();
  await expect(
    page.getByText("Detective: town, investigate at night", { exact: false }),
  ).toHaveCount(0);
});

test("rules controls update phase timing and visibility without resetting other rules", async ({
  page,
}) => {
  await page.goto("/?capture=game-customization--rules", {
    waitUntil: "networkidle",
  });
  await page.getByLabel("Day duration (seconds)", { exact: true }).fill("150");
  await page
    .getByRole("button", { name: "Reveal on death: none", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Allow whispers", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Allow whispers", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByLabel("Day duration (seconds)", { exact: true }),
  ).toHaveValue("150");
});

test("custom roles can be edited without duplicating their identity", async ({
  page,
}) => {
  await page.goto("/?capture=game-customization--custom-roles", {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("button", { name: "Edit Field Medic", exact: true })
    .click();
  await expect(page.getByLabel("Role ID", { exact: true })).not.toBeEditable();
  await page.getByLabel("Role name", { exact: true }).fill("Veteran Medic");
  await page.getByLabel("Ability charges", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Save role changes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit Veteran Medic", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Edit Field Medic", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit Veteran Medic", exact: true })
    .click();
  await expect(page.getByLabel("Ability charges", { exact: true })).toHaveValue(
    "2",
  );
});

for (const outcome of ["scenario", "unavailable", "rejected"]) {
  test(`sandbox exposes ${outcome} runtime outcomes`, async ({ page }) => {
    await page.goto(`/?capture=features-role-sandbox--${outcome}`, {
      waitUntil: "networkidle",
    });
    await page
      .getByRole("button", { name: "Run scenario", exact: true })
      .click();
    if (outcome === "unavailable") {
      await expect(page.getByRole("alert")).toContainText(
        "Sandbox unavailable",
      );
      await expect(
        page.getByText("Scenario results", { exact: true }),
      ).toHaveCount(0);
    } else {
      await expect(
        page.getByText("Scenario results", { exact: true }),
      ).toBeVisible();
      await expect(
        page
          .getByText(
            outcome === "rejected"
              ? "No ability charges remaining."
              : "Target protected.",
            { exact: true },
          )
          .first(),
      ).toBeVisible();
    }
  });
}

test("admin games supports room lookup, paging, refresh and roster review", async ({ page }) => {
  await page.goto("/?capture=features-admin-games--controls", { waitUntil: "networkidle" });
  await expect(page.getByText("Game night", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Game night", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByLabel("Room ID", { exact: true }).fill("game-night");
  await page.getByRole("button", { name: "Find room", exact: true }).click();
  await expect(page.getByText("Quick join", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "View players in Game night", exact: true }).click();
  await expect(page.getByText("Theo", { exact: true })).toBeVisible();
  await expect(page.getByText("Disconnected · Eliminated", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "All games", exact: true }).click();
  await expect(page.getByText("Quick join", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText("Game night", { exact: true })).toBeVisible();
});
