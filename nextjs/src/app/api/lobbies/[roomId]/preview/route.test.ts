import { beforeEach, expect, it, vi } from "vitest";
const load = vi.hoisted(() => vi.fn());
vi.mock("~/server/lobbyPreview", () => ({ loadLobbyPreview: load }));
import { GET } from "./route";
import { createLobbyPreview } from "@mernmafia/shared/game/lobbyPreview";
import { lobbyConfigSchema } from "@mernmafia/shared/game/lobbyConfig";
const request = new Request("http://localhost/api/lobbies/custom/preview");
const context = (roomId = "custom") => ({
  params: Promise.resolve({ roomId }),
});
beforeEach(() => vi.clearAllMocks());
it("validates the room before querying", async () => {
  expect((await GET(request, context("bad/room"))).status).toBe(400);
  expect(load).not.toHaveBeenCalled();
});
it("returns a public no-store setup without requiring sign-in", async () => {
  const preview = createLobbyPreview(
    "custom",
    lobbyConfigSchema.parse({
      size: 2,
      roleSelection: {
        algorithm: "explicit-slots",
        roles: [],
        explicitSlots: ["doctor", "mafia"],
      },
    }),
  );
  load.mockResolvedValue(preview);
  const response = await GET(request, context());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual(preview);
});
it("distinguishes normal rooms from unavailable storage without disclosing internals", async () => {
  load
    .mockResolvedValueOnce(null)
    .mockRejectedValueOnce(new Error("private database URL"));
  expect((await GET(request, context())).status).toBe(404);
  const response = await GET(request, context());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private database URL");
});
