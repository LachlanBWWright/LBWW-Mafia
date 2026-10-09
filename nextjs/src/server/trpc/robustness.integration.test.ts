import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  users,
  matches,
  matchParticipants,
  directMessages,
  userBlocks,
  friendships,
  requestLimits,
} from "@mernmafia/db/schema";
import { db } from "~/server/db";
import { trpcServices as services } from "./services";
import {
  createMobileSession,
  refreshMobileSession,
  verifyMobileToken,
  revokeDeviceSession,
  changePassword,
} from "../auth/mobileToken";
import { hashPassword } from "../auth/password";
import { consumeLimit } from "../reliability/requests";
import { POST as register } from "../../app/api/account/register/route";
vi.mock("~/server/auth", () => ({ auth: async () => null }));
const prefix = `robust-${crypto.randomUUID()}`;
const a = `${prefix}-a`,
  b = `${prefix}-b`;
const game = {
  gameId: `${prefix}-game`,
  roomName: prefix,
  startedAt: new Date().toISOString(),
  endedAt: new Date().toISOString(),
  winningFaction: "Town",
  winningRoles: ["Doctor"],
  participants: [{ userId: a, username: "A", role: "Doctor", won: true }],
  conversationHistory: [],
  actionHistory: [],
};
describe("concurrency and outage recovery", () => {
  beforeAll(async () => {
    await db.insert(users).values([
      {
        id: a,
        email: `${a}@test.invalid`,
        passwordHash: await hashPassword("old-password-123"),
      },
      { id: b, email: `${b}@test.invalid` },
    ]);
  });
  afterAll(async () => {
    await db
      .delete(matches)
      .where(inArray(matches.gameId, [game.gameId, `${prefix}-bad`]));
    await db
      .delete(users)
      .where(
        inArray(users.email, [
          `${a}@test.invalid`,
          `${b}@test.invalid`,
          `${prefix}@test.invalid`,
        ]),
      );
    await db.$client.end({ timeout: 1 });
  });
  it("stores exactly one complete match when several retries race", async () => {
    const saved = await Promise.all(
      Array.from({ length: 8 }, () => services.persistMatch(game)),
    );
    expect(new Set(saved.map((row) => row.id)).size).toBe(1);
    const rows = await db
      .select()
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, saved[0]!.id));
    expect(rows).toHaveLength(1);
  });
  it("rolls back the match when participant persistence fails", async () => {
    await expect(
      services.persistMatch({
        ...game,
        gameId: `${prefix}-bad`,
        participants: [
          { ...game.participants[0]!, userId: "nonexistent-account" },
        ],
      }),
    ).rejects.toThrow();
    expect(
      await db
        .select()
        .from(matches)
        .where(eq(matches.gameId, `${prefix}-bad`)),
    ).toHaveLength(0);
  });
  it("deduplicates message retries and rejects reuse with different content", async () => {
    await services.requestFriend(a, b);
    await services.respondFriend(b, a, true);
    const sent = await Promise.all(
      Array.from({ length: 5 }, () =>
        services.sendDirectMessage(a, b, "once", `${prefix}-command`),
      ),
    );
    expect(new Set(sent.map((row) => row.id)).size).toBe(1);
    await expect(
      services.sendDirectMessage(a, b, "different", `${prefix}-command`),
    ).rejects.toThrow("reused");
  });
  it("rechecks authorization after waiting on a concurrent relationship change", async () => {
    let locked!: () => void, release!: () => void;
    const acquired = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const proceed = new Promise<void>((resolve) => {
      release = resolve;
    });
    const blocking = db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([a, b].sort())}, 0))`,
      );
      await tx.insert(userBlocks).values({ blockerId: b, blockedId: a });
      locked();
      await proceed;
    });
    await acquired;
    const sending = services.sendDirectMessage(
      a,
      b,
      "forbidden",
      `${prefix}-blocked`,
    );
    // Attach immediately so a rejected promise cannot become unhandled.
    const assertion = expect(sending).rejects.toThrow();
    release();
    await blocking;
    await assertion;
    expect(
      await db
        .select()
        .from(directMessages)
        .where(eq(directMessages.commandId, `${prefix}-blocked`)),
    ).toHaveLength(0);
    await db
      .delete(userBlocks)
      .where(and(eq(userBlocks.blockerId, b), eq(userBlocks.blockedId, a)));
    await services.blockUser(a, b);
    expect(
      await db.select().from(friendships).where(eq(friendships.requesterId, a)),
    ).toHaveLength(0);
  });
  it("disables password registration", async () => {
    expect(register().status).toBe(410);
  });
  it("rotates refresh credentials once and revokes individual devices", async () => {
    const first = await createMobileSession({ id: a }, "First phone");
    const second = await createMobileSession({ id: a }, "Second phone");
    const refreshed = await Promise.all([
      refreshMobileSession(first.refreshToken),
      refreshMobileSession(first.refreshToken),
    ]);
    expect(refreshed.filter(Boolean)).toHaveLength(1);
    expect(await refreshMobileSession(first.refreshToken)).toBeNull();
    await revokeDeviceSession(a, first.sessionId);
    expect(await verifyMobileToken(first.token)).toBeNull();
    expect(await verifyMobileToken(second.token)).not.toBeNull();
    await changePassword(a, "old-password-123", "new-password-456");
    expect(await verifyMobileToken(second.token)).toBeNull();
    expect(await refreshMobileSession(second.refreshToken)).toBeNull();
  });
  it("enforces shared request limits atomically across connections", async () => {
    const allowed = await Promise.all(
      Array.from({ length: 10 }, () => consumeLimit(prefix, 3)),
    );
    expect(allowed.filter(Boolean)).toHaveLength(3);
    await db
      .delete(requestLimits)
      .where(sql`${requestLimits.windowStart} < now() - interval '1 day'`);
  });
});
