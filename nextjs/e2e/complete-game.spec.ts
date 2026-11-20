import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { createAccountFixture } from "./account-fixture";

test.setTimeout(90_000);

async function playersTab(page: Page) {
  const tab = page.getByRole("button", { name: "Players", exact: true });
  if (await tab.isVisible()) await tab.click();
}

async function createGame(
  context: BrowserContext,
  request: APIRequestContext,
  roles: string[],
) {
  const owner = await createAccountFixture("Simulation host");
  const response = await request.post("/api/lobbies", {
    headers: { authorization: `Bearer ${owner.token}` },
    data: {
      size: roles.length,
      roleSelection: {
        algorithm: "explicit-slots",
        roles: [],
        explicitSlots: roles,
      },
      rules: {
        timing: {
          firstDaySeconds: 5,
          daySeconds: 20,
          nightSeconds: 15,
          earlyEnd: true,
        },
        voting: { allowRevote: true },
      },
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const { roomId } = (await response.json()) as { roomId: string };
  const pages: Page[] = [];
  for (const index of roles.keys()) {
    const page = await context.newPage();
    pages[index] = page;
    await page.goto(`/lobby?room=${roomId}`);
    await page.getByRole("button", { name: "Join match", exact: true }).click();
    await expect(page.getByLabel("Your player name")).not.toBeEmpty();
  }
  await Promise.all(
    pages.map(async (page) => {
      await expect(page.locator('[aria-label$="is alive"]')).toHaveCount(
        roles.length,
      );
      await expect(page.getByLabel("Your player name")).toContainText(
        /Doctor|Mafia/,
      );
    }),
  );
  return { context, pages, roomId, token: owner.token };
}

async function identity(page: Page) {
  const text = await page.getByLabel("Your player name").innerText();
  const [name, role] = text.split("·").map((value) => value.trim());
  if (!name || !role) throw new Error(`Missing player identity: ${text}`);
  return { page, name, role };
}

async function target(page: Page, action: "Visit" | "Vote for", name: string) {
  await playersTab(page);
  const button = page.getByRole("button", {
    name: `${action} ${name}`,
    exact: true,
  });
  await expect(button).toBeEnabled();
  await button.click();
}

async function expectRecap(
  pages: Page[],
  winner: "Town" | "Mafia",
  names: string[],
) {
  await Promise.all(
    pages.map(async (page) => {
      await playersTab(page);
      const recap = page.getByRole("region", { name: "Match recap" });
      await expect(
        recap.getByRole("heading", { name: `${winner} wins` }),
      ).toBeVisible({ timeout: 30_000 });
      for (const name of names) await expect(recap).toContainText(name);
      await expect(recap).toContainText("Doctor");
      await expect(recap).toContainText("Mafia");
      await recap.getByText("Match timeline").click();
      await expect(recap).toContainText(new RegExp(`${winner} won\\.`, "i"));
    }),
  );
}

test("doctors protect against a night attack, then town votes out the mafia", async ({
  context,
  request,
}) => {
  const game = await createGame(context, request, [
    "doctor",
    "doctor",
    "mafia",
  ]);
  try {
    const players = await Promise.all(game.pages.map(identity));
    expect(new Set(players.map((player) => player.name)).size).toBe(3);
    const mafia = players.find((player) => player.role === "Mafia");
    const doctors = players.filter((player) => player.role === "Doctor");
    expect(mafia).toBeDefined();
    expect(doctors).toHaveLength(2);
    if (!mafia || !doctors[0] || !doctors[1])
      throw new Error("Unexpected roles");
    await Promise.all(
      game.pages.map((page) =>
        expect(
          page.getByRole("heading", { name: "Night 1", exact: true }),
        ).toBeVisible(),
      ),
    );
    await Promise.all([
      target(doctors[0].page, "Visit", doctors[1].name),
      target(doctors[1].page, "Visit", doctors[0].name),
    ]);
    await target(mafia.page, "Vote for", doctors[0].name);
    await Promise.all(
      game.pages.map((page) =>
        expect(
          page.getByRole("heading", { name: "Day 2", exact: true }),
        ).toBeVisible(),
      ),
    );
    await Promise.all(
      game.pages.map((page) =>
        expect(page.locator('[aria-label$="is alive"]')).toHaveCount(3),
      ),
    );
    await Promise.all(
      doctors.map((doctor) => target(doctor.page, "Vote for", mafia.name)),
    );
    await mafia.page
      .getByRole("button", { name: "Abstain", exact: true })
      .click();
    await expectRecap(
      game.pages,
      "Town",
      players.map((player) => player.name),
    );
  } finally {
    await game.context.close();
    await request.delete(`/api/lobbies/${game.roomId}`, {
      headers: { authorization: `Bearer ${game.token}` },
    });
  }
});

test("mafia wins after an unprotected night attack", async ({
  context,
  request,
}) => {
  const game = await createGame(context, request, ["doctor", "mafia"]);
  try {
    const players = await Promise.all(game.pages.map(identity));
    const mafia = players.find((player) => player.role === "Mafia");
    const doctor = players.find((player) => player.role === "Doctor");
    if (!mafia || !doctor) throw new Error("Unexpected roles");
    await Promise.all(
      game.pages.map((page) =>
        expect(
          page.getByRole("heading", { name: "Night 1", exact: true }),
        ).toBeVisible(),
      ),
    );
    await target(doctor.page, "Visit", mafia.name);
    await target(mafia.page, "Vote for", doctor.name);
    await expectRecap(
      game.pages,
      "Mafia",
      players.map((player) => player.name),
    );
    await Promise.all(
      game.pages.map((page) =>
        page.getByRole("button", { name: "Play again", exact: true }).click(),
      ),
    );
    await Promise.all(
      game.pages.map(async (page) => {
        await expect(
          page.getByRole("region", { name: "Match recap" }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("heading", { name: /^(Day 1|Night 1)$/ }),
        ).toBeVisible();
        await expect(page.locator('[aria-label$="is alive"]')).toHaveCount(2);
      }),
    );
  } finally {
    await game.context.close();
    await request.delete(`/api/lobbies/${game.roomId}`, {
      headers: { authorization: `Bearer ${game.token}` },
    });
  }
});
