import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { storybookStories } from "./storybook-stories.mjs";

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
  await page.getByRole("button", { name: "Your action", exact: true }).click();
  await expect(page.getByRole("button", { name: "Players", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Visit Mira", exact: true }).click();
  await expect(
    page.getByText("Protection selected: Mira.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel action", exact: true }).click();
  await expect(page.getByText("Night action cancelled.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to day", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Visit Mira", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue to day", exact: true })
    .click();
  await expect(page.getByText("Day 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(page.getByLabel("Game chat")).toContainText("I saw Theo near my house");
  const message = page.getByLabel("Message", { exact: true });
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  await message.fill("Mira, thank you for the clue.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(message).toHaveValue("");
  await expect(page.getByLabel("Game chat").getByText("You", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Game chat")).toContainText("Mira, thank you for the clue.");
  await page.getByRole("button", { name: "Players", exact: true }).click();
  await page
    .getByRole("button", { name: "Vote for Theo", exact: true })
    .click();
  await expect(page.getByText("Town wins", { exact: true })).toBeVisible();
  await expect(page.getByText("Mafia", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Match timeline +", exact: true }).click();
  await expect(page.getByText("Day 2 · You voted for Theo.", { exact: true })).toBeVisible();
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

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width + 1);
}

test("production match tabs expose selection, role details, and bot mute", async ({ page }) => {
  await page.goto("/?capture=mobile-ui-kit--match-night", { waitUntil: "networkidle" });
  const players = page.getByRole("button", { name: "Players", exact: true });
  const chat = page.getByRole("button", { name: "Chat", exact: true });
  await expect(players).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("timer")).toHaveText("0:18");
  await expect(page.getByRole("button", { name: "Visit Mira", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Visit Sam", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Visit Theo", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Cancel action", exact: true })).toBeInViewport();
  await expect(page.getByText("Night action selected: Theo. You can change it until dawn.", { exact: true })).toBeInViewport();
  const role = page.getByRole("button", { name: "Your role: Doctor +", exact: true });
  await expect(role).toHaveAttribute("aria-expanded", "false");
  await role.click();
  await expect(page.getByRole("button", { name: "Your role: Doctor −", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expectNoHorizontalOverflow(page);
  await chat.click();
  await expect(chat).toHaveAttribute("aria-pressed", "true");
  await expect(players).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Visit Theo", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Game chat")).toContainText("Let's compare our votes.");
  await page.getByRole("button", { name: "Mute bots", exact: true }).click();
  await expect(page.getByLabel("Game chat")).not.toContainText("Let's compare our votes.");
  await expect(page.getByLabel("Game chat")).toContainText("Who did you watch last night?");
  await page.getByRole("button", { name: "Unmute bots", exact: true }).click();
  await expect(page.getByLabel("Game chat")).toContainText("Let's compare our votes.");
  await expectNoHorizontalOverflow(page);
});

test("production voting preserves your submitted vote and public totals", async ({ page }) => {
  await page.goto("/?capture=mobile-ui-kit--match-voting", { waitUntil: "networkidle" });
  await expect(page.getByText("Your vote: Theo", { exact: true })).toBeVisible();
  await expect(page.getByText("2 votes · Leading", { exact: true })).toBeVisible();
  await expect(page.getByText(/Voted for Theo/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Vote for Theo", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Vote for Nadia", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Abstain", exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("production hidden voting reveals your choice without public vote metadata", async ({ page }) => {
  await page.goto("/?capture=mobile-ui-kit--match-hidden-votes", { waitUntil: "networkidle" });
  await expect(page.getByText("Votes hidden", { exact: true })).toBeVisible();
  await expect(page.getByText("Your vote: Theo", { exact: true })).toBeVisible();
  await expect(page.getByText(/Voted for Theo|Not voted|Abstained|Leading|votes to eliminate/)).toHaveCount(0);
  await expect(page.getByText(/^\d+ votes?$/)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("production reconnect pauses action, cancellation, and chat submission", async ({ page }) => {
  await page.goto("/?capture=mobile-ui-kit--match-reconnecting", { waitUntil: "networkidle" });
  await expect(page.getByRole("alert").filter({ hasText: "Reconnecting… Actions are paused." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Visit Theo", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Visit Nadia", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Cancel action", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(page.getByLabel("Message", { exact: true })).not.toBeEditable();
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  await expectNoHorizontalOverflow(page);
});

test("production recap exposes timeline and lets players return to match chat", async ({ page }) => {
  await page.goto("/?capture=mobile-ui-kit--match-recap", { waitUntil: "networkidle" });
  await expect(page.getByText("Town wins", { exact: true })).toBeVisible();
  await expect(page.getByText("1/4 ready", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play again", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Cancel action", exact: true })).toHaveCount(0);
  await expect(page.getByText("Your vote: Theo", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Match timeline +", exact: true }).click();
  await expect(page.getByText("Day 3 · Nadia was voted out (Mafia).", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Match timeline −", exact: true }).click();
  await expect(page.getByText("Day 3 · Nadia was voted out (Mafia).", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(page.getByLabel("Game chat")).toBeVisible();
  await expect(page.getByLabel("Message", { exact: true })).not.toBeEditable();
  await page.getByRole("button", { name: "Players", exact: true }).click();
  await expect(page.getByText("Town wins", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("production home introduces discussion and keeps lobby entry accessible", async ({ page }) => {
  await page.goto("/?capture=screens-home--landing", { waitUntil: "networkidle" });
  await expect(page.getByText("Example discussion", { exact: true })).toBeVisible();
  await expect(page.getByText("Day 2", { exact: true })).toBeVisible();
  await expect(page.getByText("Mira voted for Theo.", { exact: true })).toBeVisible();
  await expect(page.getByText("An alibi or a bluff? Your vote could decide the day.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Join Game", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Create Lobby", exact: true })).toBeEnabled();
  await expectNoHorizontalOverflow(page);
});
