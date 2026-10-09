import { expect, test, type BrowserContext, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function openWindows(
  context: BrowserContext,
  count = 3,
  roomId = `playwright-room-${Date.now()}-${Math.random().toString(36).slice(2)}`,
) {
  const pages: Page[] = [];
  for (let index = 0; index < count; index += 1) {
    const page = await context.newPage();
    await page.goto(`/lobby?room=${encodeURIComponent(roomId)}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByLabel("Assigned player name")).toContainText(
      "You joined as",
    );
    pages.push(page);
  }

  await Promise.all(
    pages.map(async (page) => {
      await expect(page.getByLabel("Assigned player name")).toContainText(
        "You joined as",
      );
      await expect(page.locator('[aria-label$="is alive"]')).toHaveCount(count);
      await expect(
        page.getByText(/Day \d+|Night/, { exact: false }).first(),
      ).toBeVisible();
    }),
  );
  return pages;
}

function aliveRows(page: Page) {
  return page.locator('[aria-label$="is alive"]');
}

function enabledAction(page: Page, name: string) {
  return page.locator(`button[aria-label="${name}"]:not([disabled])`).first();
}

test("three browser windows join one real room and synchronize live chat", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const pages = await openWindows(context);

  try {
    const message = "hello from browser window one";
    const firstPage = pages[0];
    if (!firstPage) throw new Error("first browser window was not created");
    const input = firstPage.getByPlaceholder("Send a message...");
    await input.fill(message);
    await firstPage.getByRole("button", { name: "Send", exact: true }).click();

    await Promise.all(
      pages.map((page) =>
        expect(page.getByText(/hello from browser window one/)).toBeVisible(),
      ),
    );
    await Promise.all(
      pages.map((page) => expect(aliveRows(page)).toHaveCount(3)),
    );
  } finally {
    await context.close();
  }
});

test("two windows exchange a targeted whisper and can complete a tied vote", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const pages = await openWindows(context);

  try {
    const draft = "secret between windows";
    const firstPage = pages[0];
    const secondPage = pages[1];
    const thirdPage = pages[2];
    if (!firstPage || !secondPage || !thirdPage) {
      throw new Error("expected three browser windows");
    }
    await firstPage.getByPlaceholder("Send a message...").fill(draft);
    await enabledAction(firstPage, "Whisper to player").click();

    await expect(firstPage.getByText(new RegExp(draft))).toBeVisible();
    await expect(secondPage.getByText(new RegExp(draft))).toBeVisible();
    // Whispers intentionally have a chance of being overheard by the town.
    if (
      await firstPage
        .getByText("Your whispers were overheard by the town!", { exact: true })
        .isVisible()
    ) {
      await expect(
        thirdPage.getByText(new RegExp(`tried to whisper "${draft}"`)),
      ).toBeVisible();
    } else {
      await expect(
        firstPage.getByText(new RegExp(`Whisper to .*: ${draft}`)),
      ).toBeVisible();
      await expect(
        secondPage.getByText(new RegExp(`Whisper from .*: ${draft}`)),
      ).toBeVisible();
      await expect(thirdPage.getByText(new RegExp(draft))).not.toBeVisible();
    }

    // Each voter selects a different target. The real room should advance to
    // Night without eliminating anyone because the vote is tied.
    const voteTargets = [1, 2, 0];
    await Promise.all(
      pages.map(async (page, voter) => {
        const target = voteTargets[voter];
        if (target === undefined) throw new Error("missing vote target");
        await aliveRows(page)
          .nth(target)
          .getByRole("button", { name: "Vote player" })
          .click();
      }),
    );
    await Promise.all(
      pages.map((page) =>
        expect(page.getByText(/has voted for/)).toHaveCount(3),
      ),
    );
    await Promise.all(
      pages.map((page) => expect(aliveRows(page)).toHaveCount(3)),
    );
    await Promise.all(
      pages.map((page) =>
        expect(page.getByText("Night", { exact: true })).toBeVisible(),
      ),
    );
  } finally {
    await context.close();
  }
});

test("a disconnected browser window is reflected in the remaining windows", async ({
  browser,
}) => {
  test.setTimeout(45_000);
  const context = await browser.newContext();
  const pages = await openWindows(context, 2);

  try {
    const remainingPages = pages.slice(0, 1);
    await pages[1]?.close();
    await Promise.all(
      remainingPages.map((page) =>
        expect(page.getByText(/left the room|abandoned the game/i)).toBeVisible(
          { timeout: 35_000 },
        ),
      ),
    );
  } finally {
    await context.close();
  }
});

test("a browser can reload and reconnect to the same live room", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const pages = await openWindows(context, 2);

  try {
    const page = pages[0];
    if (!page) throw new Error("expected a browser window");
    const roomId = new URL(page.url()).searchParams.get("room");
    if (!roomId) throw new Error("expected a room id in the lobby URL");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Assigned player name")).toContainText(
      "You joined as",
    );
    await expect(aliveRows(page)).toHaveCount(2);
    await expect(
      page.getByText(/Day \d+|Night/, { exact: false }).first(),
    ).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`room=${encodeURIComponent(roomId)}`),
    );
  } finally {
    await context.close();
  }
});

test("an invalid room identifier falls back to the current matchmaking room", async ({
  page,
}) => {
  await page.goto("/lobby?room=not%20a%20valid%20room!", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByLabel("Assigned player name")).toContainText(
    "You joined as",
  );
  await expect(aliveRows(page)).toHaveCount(1);
});

test("signed-out users are redirected from authenticated messaging", async ({
  page,
}) => {
  await page.goto("/messages", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/signin$/);
  await expect(
    page.getByText("Sign in", { exact: true }).first(),
  ).toBeVisible();
});
