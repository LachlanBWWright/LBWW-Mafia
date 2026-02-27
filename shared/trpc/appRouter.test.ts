import assert from "node:assert/strict";
import test from "node:test";
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

test("recentByUsername returns typed history rows", async () => {
  const caller = appRouter.createCaller({ sessionUser: null });
  const result = await caller.match.recentByUsername({
    username: "alex",
    limit: 5,
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.winningFaction, "town");
});

test("recentForCurrentUser rejects unauthenticated calls", async () => {
  const caller = appRouter.createCaller({ sessionUser: null });

  await assert.rejects(
    () => caller.match.recentForCurrentUser({ limit: 5 }),
    (error: unknown) =>
      error instanceof TRPCError && error.code === "UNAUTHORIZED",
  );
});

test("admin search rejects non-admin calls", async () => {
  const caller = appRouter.createCaller({
    sessionUser: {
      id: "2",
      name: "Player",
      isAdmin: false,
    },
  });

  await assert.rejects(
    () => caller.admin.searchUsers({ query: "", limit: 10 }),
    (error: unknown) => error instanceof TRPCError && error.code === "FORBIDDEN",
  );
});

test("recentForCurrentUser resolves for authenticated user", async () => {
  const caller = appRouter.createCaller({
    sessionUser: {
      id: "3",
      name: "alex",
      isAdmin: false,
    },
  });
  const result = await caller.match.recentForCurrentUser({ limit: 2 });
  assert.equal(result.length, 1);
});

test("admin setUserAdmin mutates when caller is admin", async () => {
  setUserAdminCalls = 0;
  const caller = appRouter.createCaller({
    sessionUser: {
      id: "1",
      name: "Admin",
      isAdmin: true,
    },
  });
  const result = await caller.admin.setUserAdmin({ userId: "2", isAdmin: true });
  assert.equal(result.success, true);
  assert.equal(setUserAdminCalls, 1);
});
