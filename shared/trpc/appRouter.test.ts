import { describe, it, expect, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { createAppRouter } from "./appRouter";

let setUserAdminCalls = 0;
const mockServices = {
  getRecentMatches: async () => [
    {
      id: 1,
      roomName: "room-alpha",
      endedAt: new Date("2026-02-16T00:00:00Z"),
      winningFaction: "town",
      winningRoles: ["Doctor"],
      participants: [{ username: "alex", role: "Doctor", won: true }],
      conversationCount: 4,
      actionCount: 8,
    },
  ],
  searchUsers: async () => [
    { id: "1", name: "Admin", email: "admin@example.com", isAdmin: true },
  ],
  setUserAdmin: async () => {
    setUserAdminCalls += 1;
  },
};

const appRouter = createAppRouter(mockServices);

describe("appRouter", () => {
  it("recentByUsername returns match list", async () => {
    const caller = appRouter.createCaller({ sessionUser: null });
    const result = await caller.match.recentByUsername({ username: "alex", limit: 5 });
    expect(result.length).toBe(1);
    expect(result[0]?.roomName).toBe("room-alpha");
    expect(result[0]?.winningFaction).toBe("town");
  });

  it("recentByUsername rejects invalid input", async () => {
    const caller = appRouter.createCaller({ sessionUser: null });
    await expect(caller.match.recentByUsername({ username: "", limit: 5 })).rejects.toBeInstanceOf(TRPCError);
  });

  it("recentForCurrentUser rejects unauthenticated calls", async () => {
    const caller = appRouter.createCaller({ sessionUser: null });
    await expect(caller.match.recentForCurrentUser({ limit: 2 })).rejects.toSatisfy(
      (error: unknown) => error instanceof TRPCError && error.code === "UNAUTHORIZED",
    );
  });

  it("admin search rejects non-admin calls", async () => {
    const caller = appRouter.createCaller({
      sessionUser: { id: "2", name: "user", isAdmin: false },
    });
    await expect(caller.admin.searchUsers({ query: "", limit: 10 })).rejects.toSatisfy(
      (error: unknown) => error instanceof TRPCError && error.code === "FORBIDDEN",
    );
  });

  it("recentForCurrentUser resolves for authenticated user", async () => {
    const caller = appRouter.createCaller({
      sessionUser: { id: "3", name: "alex", isAdmin: false },
    });
    const result = await caller.match.recentForCurrentUser({ limit: 2 });
    expect(result.length).toBe(1);
  });

  it("admin setUserAdmin mutates when caller is admin", async () => {
    setUserAdminCalls = 0;
    const caller = appRouter.createCaller({
      sessionUser: { id: "1", name: "Admin", isAdmin: true },
    });
    const result = await caller.admin.setUserAdmin({ userId: "2", isAdmin: true });
    expect(result.success).toBe(true);
    expect(setUserAdminCalls).toBe(1);
  });
});
