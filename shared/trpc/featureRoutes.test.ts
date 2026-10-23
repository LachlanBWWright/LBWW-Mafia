import { describe, expect, it, vi } from "vitest";
import { createAppRouter, type RouterServices } from "./appRouter";
function services() {
  return {
    parties: {
      current: vi.fn().mockResolvedValue(null),
      move: vi.fn().mockResolvedValue(undefined),
      invite: vi.fn().mockResolvedValue(null),
    },
    analysis: {
      getReplay: vi.fn().mockResolvedValue({ id: 12 }),
      getBalance: vi.fn().mockResolvedValue({ sampleSize: 0 }),
    },
  };
}
describe("authenticated party and match analysis routes", () => {
  it("does not grant a backend connection access to account-specific features", async () => {
    const mock = services();
    const caller = createAppRouter(
      mock as unknown as RouterServices,
    ).createCaller({ sessionUser: null, isBackend: true });
    await expect(caller.party.current()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller.match.replay({ matchId: 12 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller.match.balance({ limit: 200 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(mock.analysis.getReplay).not.toHaveBeenCalled();
  });
  it("takes party actor and replay viewer identity from the authenticated session", async () => {
    const mock = services();
    const caller = createAppRouter(
      mock as unknown as RouterServices,
    ).createCaller({
      sessionUser: { id: "member", isAdmin: false },
      isBackend: false,
    });
    await caller.party.invite({ recipientId: "friend" });
    await caller.party.move({ roomId: "new-lobby" });
    await caller.match.replay({ matchId: 12 });
    expect(mock.parties.invite).toHaveBeenCalledWith("member", {
      recipientId: "friend",
    });
    expect(mock.parties.move).toHaveBeenCalledWith("member", {
      roomId: "new-lobby",
    });
    expect(mock.analysis.getReplay).toHaveBeenCalledWith({
      matchId: 12,
      viewerId: "member",
      isAdmin: false,
    });
  });
  it("rejects unbounded scans and malformed lobby destinations before services run", async () => {
    const mock = services();
    const caller = createAppRouter(
      mock as unknown as RouterServices,
    ).createCaller({
      sessionUser: { id: "member", isAdmin: true },
      isBackend: false,
    });
    await expect(caller.match.balance({ limit: 501 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      caller.party.move({ roomId: "../room" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mock.analysis.getBalance).not.toHaveBeenCalled();
    expect(mock.parties.move).not.toHaveBeenCalled();
  });
});
