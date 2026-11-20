import { afterEach, describe, expect, it, vi } from "vitest";
import { requestLobbyInfo } from "./lobbyInfo";
afterEach(() => vi.unstubAllGlobals());
describe("lobby information", () => {
  it("validates the requested room and distinguishes missing rooms", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          roomId: "room",
          name: "Friday",
          hostName: "Mira",
          visibility: "public",
          players: 2,
          capacity: 8,
          status: "waiting",
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(
        Response.json({
          roomId: "other",
          name: "Wrong",
          hostName: null,
          visibility: "link-only",
          players: 0,
          capacity: 8,
          status: "waiting",
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(await requestLobbyInfo("room")).toMatchObject({
      status: "waiting",
      players: 2,
    });
    expect(await requestLobbyInfo("room")).toBeNull();
    await expect(requestLobbyInfo("room")).rejects.toThrow("Lobby mismatch");
  });
});
