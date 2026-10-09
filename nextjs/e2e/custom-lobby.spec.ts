import { expect, test } from "@playwright/test";
import { createAccountFixture } from "./account-fixture";

test("saved custom lobby rules determine the live player count and roles", async ({
  browser,
  request,
}) => {
  const { token } = await createAccountFixture();
  const response = await request.post("/api/lobbies", {
    headers: { authorization: `Bearer ${token}` },
    data: {
      size: 2,
      roleSelection: {
        algorithm: "explicit-slots",
        roles: [],
        explicitSlots: ["doctor", "mafia"],
      },
    },
  });
  expect(response.ok()).toBe(true);
  const { roomId } = (await response.json()) as { roomId: string };
  const context = await browser.newContext();
  try {
    const first = await context.newPage();
    const second = await context.newPage();
    await first.goto(`/lobby?room=${roomId}`);
    await expect(first.getByLabel("Assigned player name")).toContainText(
      "You joined as",
    );
    await second.goto(`/lobby?room=${roomId}`);
    await expect(second.getByLabel("Assigned player name")).toContainText(
      "You joined as",
    );
    await expect(first.locator('[aria-label$="is alive"]')).toHaveCount(2);
    await expect(second.locator('[aria-label$="is alive"]')).toHaveCount(2);
    await expect
      .poll(async () => {
        const roles = await Promise.all(
          [first, second].map((page) =>
            page
              .locator('[data-testid="player-row"]')
              .filter({ hasText: "(You)" })
              .innerText(),
          ),
        );
        return roles.join(" ");
      })
      .toMatch(/Doctor.*Mafia|Mafia.*Doctor/s);
  } finally {
    await context.close();
  }
});
