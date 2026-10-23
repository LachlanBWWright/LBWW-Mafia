import { expect, test, type Page } from "@playwright/test";

const story = (name: string) =>
  `/iframe.html?id=game-match-experience--${name}&viewMode=story`;

async function showPlayers(page: Page) {
  await expect(page.getByRole("main")).toBeVisible();
  const players = page.getByRole("button", { name: "Players", exact: true });
  if (await players.isVisible()) await players.click();
  return page.getByRole("complementary", {
    name: "Players and game controls",
  });
}

async function showChat(page: Page) {
  await expect(page.getByRole("main")).toBeVisible();
  const chat = page.getByRole("button", { name: "Chat", exact: true });
  if (await chat.isVisible()) await chat.click();
  return page.getByRole("region", { name: "Room chat", exact: true });
}

function protectionButton(page: Page, player: string) {
  return page.getByRole("button", {
    name: new RegExp(`^(Protect|Visit) ${player}$`),
  });
}

test("game-match-experience practice teaches protection, voting, and replay", async ({
  page,
}) => {
  await page.goto(story("practice"));
  await expect(
    page.getByRole("heading", { name: "Night 1", exact: true }),
  ).toBeVisible();
  await showPlayers(page);
  await expect(page.getByText("Mafia", { exact: true })).toHaveCount(0);
  await protectionButton(page, "Mira").click();
  await expect(
    page.getByText("Protection selected: Mira.", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continue to day", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Day 2", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Vote for Theo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Town wins", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Mafia", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Play again", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Night 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Mafia", { exact: true })).toHaveCount(0);
});

test("night actions expose role restrictions, selection, and cancellation", async ({
  page,
}) => {
  await page.goto(story("night-action"));
  const controls = await showPlayers(page);
  await expect(
    page.getByRole("heading", { name: "Night 2", exact: true }),
  ).toBeVisible();
  await expect(protectionButton(page, "Mira")).toBeDisabled();
  await expect(protectionButton(page, "Sam")).toBeDisabled();
  await expect(protectionButton(page, "Theo")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await protectionButton(page, "Nadia").click();
  await expect(protectionButton(page, "Nadia")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(protectionButton(page, "Theo")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(
    controls.getByRole("region", { name: "Your action" }),
  ).toContainText("Nadia");
  await page
    .getByRole("button", { name: "Cancel action", exact: true })
    .click();
  await expect(protectionButton(page, "Nadia")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(
    page.getByRole("button", { name: "Cancel action", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Vote for / })).toHaveCount(0);
});

test("day voting shows public totals without exposing eliminated targets", async ({
  page,
}) => {
  await page.goto(story("voting"));
  const controls = await showPlayers(page);
  await expect(
    page.getByRole("heading", { name: "Day 2", exact: true }),
  ).toBeVisible();
  await expect(
    controls.getByText("2 votes to eliminate", { exact: true }),
  ).toBeVisible();
  await expect(
    controls.getByText("2 votes · Leading", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Vote for Theo", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Vote for Sam", exact: true }),
  ).toBeDisabled();
  await expect(
    controls.getByText("Your vote: Theo", { exact: true }),
  ).toBeVisible();
});

test("hidden voting omits counts, leaders, and other players' ballot status", async ({
  page,
}) => {
  await page.goto(story("hidden-votes"));
  const controls = await showPlayers(page);
  await expect(
    controls.getByText("Votes hidden", { exact: true }),
  ).toBeVisible();
  await expect(
    controls.getByText(/votes to eliminate|votes? · Leading|^\d+ votes?$/),
  ).toHaveCount(0);
  await expect(
    controls.getByText(/Not voted|Voted for Theo|^Abstained$/),
  ).toHaveCount(0);
  await expect(
    controls.getByText("Your vote: Theo", { exact: true }),
  ).toBeVisible();
});

test("reconnecting pauses actions and the composer while preserving the selection", async ({
  page,
}) => {
  await page.goto(story("reconnecting"));
  await expect(page.getByRole("alert")).toContainText("Actions are paused");
  await expect(
    page.getByRole("textbox", { name: "Message", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeDisabled();
  await showPlayers(page);
  for (const player of ["Mira", "Theo", "Nadia", "Sam"]) {
    await expect(protectionButton(page, player)).toBeDisabled();
  }
  await expect(protectionButton(page, "Theo")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Cancel action", exact: true }),
  ).toBeDisabled();
});

test("recap reveals roles, expands the timeline, and acknowledges rematch readiness", async ({
  page,
}) => {
  await page.goto(story("recap"));
  await expect(
    page.getByRole("heading", { name: "Town wins", exact: true }),
  ).toBeInViewport();
  const controls = await showPlayers(page);
  const recap = controls.getByRole("region", { name: "Match recap" });
  await expect(
    recap.getByRole("heading", { name: "Town wins", exact: true }),
  ).toBeVisible();
  await expect(recap.getByText("Investigator", { exact: true })).toBeVisible();
  await expect(recap.getByText("Mafia", { exact: true })).toHaveCount(2);
  await expect(
    recap.getByText("Nadia was voted out (Mafia).", { exact: false }),
  ).not.toBeVisible();
  await recap.getByText("Match timeline", { exact: true }).click();
  await expect(
    recap.getByText("Nadia was voted out (Mafia).", { exact: false }),
  ).toBeVisible();
  await recap.getByRole("button", { name: "Play again", exact: true }).click();
  await expect(
    recap.getByRole("button", { name: "Ready for next match", exact: true }),
  ).toBeDisabled();
  await expect(recap.getByText("2/4 ready", { exact: true })).toBeVisible();
});

test("narrow layouts switch between chat and controls without losing the selected action", async ({
  page,
}) => {
  await page.goto(story("night-action"));
  await expect(page.getByRole("main")).toBeVisible();
  const players = page.getByRole("button", { name: "Players", exact: true });
  test.skip(
    !(await players.isVisible()),
    "Desktop keeps chat and controls visible together.",
  );
  await expect(page.getByRole("log", { name: "Game chat" })).toBeVisible();
  await expect(protectionButton(page, "Theo")).not.toBeVisible();
  await players.click();
  await expect(players).toHaveAttribute("aria-pressed", "true");
  await expect(protectionButton(page, "Theo")).toBeVisible();
  await expect(protectionButton(page, "Theo")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("log", { name: "Game chat" })).not.toBeVisible();
  await showChat(page);
  await expect(
    page.getByRole("button", { name: "Chat", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("log", { name: "Game chat" })).toBeVisible();
  await showPlayers(page);
  await expect(protectionButton(page, "Theo")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("bot muting hides only bot discussion and can be reversed", async ({
  page,
}) => {
  await page.goto(story("night-action"));
  const chat = page.getByRole("log", { name: "Game chat" });
  await expect(
    chat.getByText("Let's compare our votes.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mute bots", exact: true }).click();
  await expect(
    chat.getByText("Let's compare our votes.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    chat.getByText("Who did you watch last night?", { exact: true }),
  ).toBeVisible();
  await expect(chat.getByText("Night 2 began.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Unmute bots", exact: true }).click();
  await expect(
    chat.getByText("Let's compare our votes.", { exact: true }),
  ).toBeVisible();
});

test("an open ballot accepts one vote and prevents a second submission", async ({
  page,
}) => {
  await page.goto(story("voting-open"));
  const controls = await showPlayers(page);
  const theo = page.getByRole("button", { name: "Vote for Theo", exact: true });
  await expect(theo).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Vote for Mira", exact: true }),
  ).toBeDisabled();
  await theo.click();
  await expect(
    controls.getByText("Your vote: Theo", { exact: true }),
  ).toBeVisible();
  await expect(theo).toHaveAttribute("aria-pressed", "true");
  await expect(theo).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Vote for Nadia", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Abstain", exact: true }),
  ).toHaveCount(0);
});

test("an open ballot permits abstaining without selecting another player", async ({
  page,
}) => {
  await page.goto(story("voting-open"));
  const controls = await showPlayers(page);
  await page.getByRole("button", { name: "Abstain", exact: true }).click();
  await expect(controls.getByText("Abstained", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Vote for Theo", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "Vote for Theo", exact: true }),
  ).toBeDisabled();
});

test("chat rejects whitespace, sends with Enter, and clears the composer", async ({
  page,
}) => {
  await page.goto(story("voting-open"));
  await showChat(page);
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  const send = page.getByRole("button", { name: "Send", exact: true });
  await expect(composer).toBeEnabled();
  await expect(send).toBeDisabled();
  await composer.fill("   ");
  await expect(send).toBeDisabled();
  await composer.fill("Compare the voting record.");
  await expect(send).toBeEnabled();
  await composer.press("Enter");
  await expect(
    page
      .getByRole("log", { name: "Game chat" })
      .getByText("Compare the voting record.", { exact: true }),
  ).toBeVisible();
  await expect(composer).toHaveValue("");
  await expect(send).toBeDisabled();
});

test("whisper uses the message draft and prevents self or eliminated recipients", async ({
  page,
}) => {
  await page.goto(story("voting-open"));
  await showPlayers(page);
  await expect(
    page.getByRole("button", { name: "Whisper to Theo", exact: true }),
  ).toBeDisabled();
  await showChat(page);
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Who did you investigate?");
  await showPlayers(page);
  await expect(
    page.getByRole("button", { name: "Whisper to Mira", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Whisper to Sam", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Whisper to Theo", exact: true })
    .click();
  await showChat(page);
  await expect(
    page
      .getByRole("log", { name: "Game chat" })
      .getByText("Whisper to Theo: Who did you investigate?", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Message", exact: true }),
  ).toHaveValue("");
});

test("a crowded roster keeps the current action and cancellation above the player list", async ({
  page,
}) => {
  await page.goto(story("long-roster"));
  await expect(page.getByRole("main")).toBeVisible();
  const viewport = page.viewportSize();
  if (viewport && viewport.width >= 1024) {
    const matchBounds = await page.getByRole("main").boundingBox();
    expect(matchBounds).not.toBeNull();
    expect(Math.abs(matchBounds!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(matchBounds!.width - viewport.width)).toBeLessThanOrEqual(
      1,
    );
    await expect(page.getByRole("log", { name: "Game chat" })).toBeInViewport();
    await expect(
      page.getByRole("complementary", { name: "Players and game controls" }),
    ).toBeInViewport();
  }
  const controls = await showPlayers(page);
  const action = controls.getByRole("region", { name: "Your action" });
  const cancel = action.getByRole("button", {
    name: "Cancel action",
    exact: true,
  });
  await expect(cancel).toBeInViewport();
  const actionBounds = await action.boundingBox();
  const firstPlayerBounds = await controls
    .getByTestId("player-row")
    .first()
    .boundingBox();
  expect(actionBounds).not.toBeNull();
  expect(firstPlayerBounds).not.toBeNull();
  expect(actionBounds!.y + actionBounds!.height).toBeLessThanOrEqual(
    firstPlayerBounds!.y + 1,
  );
  await controls.getByTestId("player-row").last().scrollIntoViewIfNeeded();
  await expect(cancel).toBeInViewport();
  await cancel.click();
  await expect(action).toContainText("Night action cancelled.");
});

test("role reference expands without revealing other living players' roles", async ({
  page,
}) => {
  await page.goto(story("night-action"));
  const controls = await showPlayers(page);
  await controls.getByText("Your role: Doctor", { exact: true }).click();
  await expect(
    controls.getByText(
      "Help Town eliminate Mafia and other hostile factions.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    controls
      .getByTestId("player-row")
      .filter({ has: page.getByText("Theo", { exact: true }) })
      .getByText("Investigator", { exact: true }),
  ).toHaveCount(0);
});

test("recovery notice can be dismissed without removing game discussion", async ({
  page,
}) => {
  await page.goto(story("reconnecting"));
  await expect(
    page.getByText("Reconnected. Sam died (Mafia). Night 2, 18s remaining.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(
    page.getByText("Reconnected. Sam died (Mafia). Night 2, 18s remaining.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("log", { name: "Game chat" })
      .getByText("Night 2 began.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Actions are paused");
});
