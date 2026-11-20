import { expect, test } from "@playwright/test";
import { createAccountFixture } from "./account-fixture";

test("public normal lobby appears with live status as players join", async ({
  browser,
  request,
}) => {
  const owner = await createAccountFixture("Lobby host");
  const created = await request.post("/api/lobbies", {
    headers: { authorization: `Bearer ${owner.token}` },
    data: {
      size: 2,
      directory: { public: true, name: "Public test game" },
      roleSelection: { algorithm: "normal", roles: [], explicitSlots: [] },
    },
  });
  expect(created.ok()).toBe(true);
  const { roomId } = (await created.json()) as { roomId: string };
  const context = await browser.newContext();
  try {
    const first = await context.newPage();
    await first.goto(`/lobby?room=${roomId}`);
    await first
      .getByRole("button", { name: "Join match", exact: true })
      .click();
    await expect(first.getByLabel("Your player name")).not.toBeEmpty();
    await expect
      .poll(async () => {
        const response = await request.get(`/api/lobbies/${roomId}/info`);
        return response.ok() ? await response.json() : null;
      })
      .toMatchObject({
        name: "Public test game",
        hostName: "Lobby host",
        players: 1,
        capacity: 2,
        status: "waiting",
      });
    await expect
      .poll(async () => {
        const response = await request.get("/api/lobbies");
        return response.ok() ? (await response.json()).lobbies : [];
      })
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            roomId,
            players: 1,
            capacity: 2,
            status: "waiting",
          }),
        ]),
      );
    const second = await context.newPage();
    await second.goto(`/lobby?room=${roomId}`);
    await second
      .getByRole("button", { name: "Join match", exact: true })
      .click();
    await expect(second.getByLabel("Your player name")).not.toBeEmpty();
    await expect
      .poll(async () => {
        const response = await request.get(`/api/lobbies/${roomId}/info`);
        return response.ok() ? await response.json() : null;
      })
      .toMatchObject({ players: 2, status: "in-progress" });
  } finally {
    await context.close();
    await request.delete(`/api/lobbies/${roomId}`, {
      headers: { authorization: `Bearer ${owner.token}` },
    });
  }
});
