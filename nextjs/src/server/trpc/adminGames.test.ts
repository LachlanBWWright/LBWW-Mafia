import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("drizzle-orm/pg-core", () => ({
  unionAll: () => ({ as: () => ({ roomId: "room", createdAt: "created" }) }),
}));
vi.mock("~/server/db", () => ({ db: { select: mocks.select } }));
vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_SOCKET_URL: "https://game.example/",
    BACKEND_SECRET: "secret",
  },
}));
vi.mock("@mernmafia/db/schema", () => ({
  quickJoinRooms: { roomId: "room", createdAt: "created" },
  activeRoom: { id: "id", roomId: "room" },
  customLobbies: { roomId: "room", config: "config", createdAt: "created" },
}));
import { listAdminGames, readAdminGame } from "./adminGames";
import { adminGamesFixture } from "@mernmafia/shared/testing/adminGamesFixtures";
const state = adminGamesFixture.games[0]!.state!;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("admin game snapshots", () => {
  it("authenticates server requests and strips private game data", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        ...state,
        role: "Mafia",
        whispers: ["secret"],
        apiKey: "private",
      }),
    );
    const room = {
      roomId: "night-one",
      name: "Night",
      visibility: "link-only" as const,
    };
    expect(await readAdminGame(room, request)).toEqual({ ...room, state });
    expect(request).toHaveBeenCalledWith(
      "https://game.example/parties/main/night-one",
      expect.objectContaining({
        cache: "no-store",
        headers: { authorization: "Bearer secret" },
        signal: expect.any(AbortSignal),
      }),
    );
  });
  it.each([
    Response.json({ ...state, connections: -1 }),
    new Response(null, { status: 503 }),
  ])(
    "marks invalid or unavailable rooms without losing their identity",
    async (response) => {
      const room = {
        roomId: "broken",
        name: "Broken",
        visibility: "public" as const,
      };
      expect(
        await readAdminGame(
          room,
          vi.fn<typeof fetch>().mockResolvedValue(response),
        ),
      ).toEqual({ ...room, state: null });
    },
  );
  it("includes link-only rooms and quick join, isolates failures, and pages registered rooms", async () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({
      roomId: `room-${i}`,
      config: JSON.stringify({
        size: 8,
        roleSelection: { algorithm: "normal", roles: [], explicitSlots: [] },
      }),
    }));
    const source = { from: () => ({ where: () => ({}) }) };
    mocks.select
      .mockReturnValueOnce(source)
      .mockReturnValueOnce(source)
      .mockReturnValueOnce({
        from: () => ({
          orderBy: () => ({ limit: () => ({ offset: async () => rows }) }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({ limit: async () => [{ roomId: "current" }] }),
        }),
      });
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockImplementation(async (url) =>
          String(url).endsWith("room-2")
            ? new Response(null, { status: 503 })
            : Response.json(state),
        ),
    );
    const page = await listAdminGames({ offset: 0 });
    expect(page.nextOffset).toBe(10);
    expect(page.games).toHaveLength(11);
    expect(page.games[0]).toMatchObject({
      roomId: "current",
      name: "Quick join",
    });
    expect(page.games.find((room) => room.roomId === "room-2")).toMatchObject({
      visibility: "link-only",
      state: null,
    });
    expect(page.games.some((room) => room.roomId === "room-10")).toBe(false);
  });
});
