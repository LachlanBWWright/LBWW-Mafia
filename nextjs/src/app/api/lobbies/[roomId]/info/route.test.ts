import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("~/server/db", () => ({ db: { select: mocks.select } }));
vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_SOCKET_URL: "https://game.example",
    BACKEND_SECRET: "secret",
  },
}));
vi.mock("@mernmafia/db/schema", () => ({
  customLobbies: { roomId: "room", config: "config", ownerId: "owner" },
  users: { id: "id", name: "name" },
}));
import { GET } from "./route";
const config = {
  size: 8,
  directory: { public: true, name: "Friday" },
  roleSelection: { algorithm: "normal", roles: [], explicitSlots: [] },
};
const request = () =>
  GET(new Request("http://localhost/api/lobbies/room/info"), {
    params: Promise.resolve({ roomId: "room" }),
  });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("lobby information", () => {
  it("reports host, visibility and live status without exposing private state", async () => {
    mocks.select.mockReturnValue({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            limit: async () => [
              { config: JSON.stringify(config), hostName: "Mira" },
            ],
          }),
        }),
      }),
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({
            players: 3,
            started: false,
            ended: false,
            closed: false,
            privateRole: "Mafia",
          }),
        ),
    );
    const response = await request();
    expect(await response.json()).toEqual({
      roomId: "room",
      name: "Friday",
      visibility: "public",
      hostName: "Mira",
      players: 3,
      capacity: 8,
      status: "waiting",
    });
  });
  it("reports a closed lobby and treats a missing lobby as unavailable", async () => {
    mocks.select.mockReturnValueOnce({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            limit: async () => [
              { config: JSON.stringify(config), hostName: null },
            ],
          }),
        }),
      }),
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({
            players: 1,
            started: false,
            ended: false,
            closed: true,
          }),
        ),
    );
    expect(await (await request()).json()).toMatchObject({ status: "closed" });
    mocks.select.mockReturnValueOnce({
      from: () => ({
        leftJoin: () => ({ where: () => ({ limit: async () => [] }) }),
      }),
    });
    expect((await request()).status).toBe(404);
  });
});
