import { afterEach, describe, expect, it, vi } from "vitest";
import { createCustomRoleDraft } from "@mernmafia/shared/game/customRoles";
import { POST } from "./route";
vi.mock("~/env", () => ({
  env: { NEXT_PUBLIC_SOCKET_URL: "wss://game.example.test" },
}));
const input = {
  role: createCustomRoleDraft(),
  nights: 1,
  targetAlignment: "mafia",
  incomingAttack: true,
};
const night = {
  night: 1,
  accepted: true,
  targetDamage: 0,
  targetDefence: 1,
  targetBlocked: false,
  redirectedToActor: false,
  notices: [],
};
function request(body: unknown = input) {
  return new Request("https://app.example.test/api/sandbox", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
afterEach(() => vi.unstubAllGlobals());
describe("sandbox proxy", () => {
  it("validates scenarios before making a Worker request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await POST(request({ nights: 100 }))).status).toBe(400);
    expect(
      (
        await POST(
          new Request("https://example.test", { method: "POST", body: "{" }),
        )
      ).status,
    ).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("forwards a validated scenario over HTTP and returns the result", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ nights: [night] }));
    vi.stubGlobal("fetch", fetch);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ nights: [night] });
    expect(fetch).toHaveBeenCalledWith(
      new URL("https://game.example.test/sandbox"),
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        body: JSON.stringify({ ...input, randomSample: 0 }),
      }),
    );
  });
  it.each([
    {},
    { nights: [] },
    { nights: [{ ...night, night: 2 }] },
    { nights: [night, { ...night, night: 2 }] },
  ])("rejects malformed or mismatched Worker results", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
    expect((await POST(request())).status).toBe(502);
  });
  it("distinguishes invalid upstream JSON from network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not JSON")));
    expect((await POST(request())).status).toBe(502);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await POST(request())).status).toBe(503);
  });
  it("preserves upstream unavailability without exposing its response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("internal details", { status: 429 })),
    );
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "Sandbox unavailable." });
  });
});
