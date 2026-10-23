import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "~/server/db";
import {
  users,
  friendships,
  customLobbies,
  lobbyInvitations,
  notifications,
  lobbyPresets,
  playerReports,
  matchParticipants,
  matches,
  directMessages,
  userPresence,
  userBlocks,
} from "@mernmafia/db/schema";
import { accountFeatureServices as features } from "./accountFeatures";
import { trpcServices as services } from "./services";
const prefix = `features-${crypto.randomUUID()}`;
const a = `${prefix}-a`,
  b = `${prefix}-b`,
  outsider = `${prefix}-c`,
  admin = `${prefix}-admin`;
const roomId = `custom-${crypto.randomUUID()}`;
const config = {
  size: 2,
  roleSelection: {
    algorithm: "explicit-slots" as const,
    roles: [],
    explicitSlots: ["doctor" as const, "mafia" as const],
  },
};
let matchId = 0;
describe("account features authorization and persistence", () => {
  beforeAll(async () => {
    await db.insert(users).values([
      { id: a, email: `${a}@invalid.local`, name: "Feature Alice" },
      { id: b, email: `${b}@invalid.local`, name: "Feature Bob" },
      { id: outsider, email: `${outsider}@invalid.local`, name: "Outsider" },
      { id: admin, email: `${admin}@invalid.local`, isAdmin: true },
    ]);
    await db
      .insert(friendships)
      .values({ requesterId: a, addresseeId: b, status: "accepted" });
    await db
      .insert(customLobbies)
      .values({ roomId, ownerId: a, config: JSON.stringify(config) });
    const saved = await services.persistMatch({
      gameId: prefix,
      roomName: prefix,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      winningFaction: "Town",
      winningRoles: ["Doctor"],
      participants: [
        { userId: a, username: "Feature Alice", role: "Doctor", won: true },
        { userId: b, username: "Feature Bob", role: "Mafia", won: false },
      ],
      conversationHistory: [
        {
          time: 1,
          type: "chat",
          actor: "Feature Alice",
          content: "private words",
        },
        {
          time: 2,
          type: "chat",
          actor: "Feature Bob",
          content: "Hello Feature Alice",
        },
      ],
      actionHistory: [],
    });
    matchId = saved.id;
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    await db
      .delete(playerReports)
      .where(inArray(playerReports.reporterId, [a, b, outsider, admin]));
    await db.delete(matches).where(eq(matches.roomName, prefix));
    await db.delete(users).where(inArray(users.id, [a, b, outsider, admin]));
    await db.$client.end({ timeout: 1 });
  });
  it("match history visibility protects ID-prefixed lookups from unauthorized viewers", async () => {
    const input = { username: `user:${a}`, limit: 10 };
    await db
      .update(users)
      .set({ historyVisibility: "private" })
      .where(eq(users.id, a));
    expect(await services.getRecentMatches(input)).toHaveLength(0);
    expect(
      await services.getRecentMatches({ ...input, viewerId: outsider }),
    ).toHaveLength(0);
    expect(
      await services.getRecentMatches({ ...input, viewerId: b }),
    ).toHaveLength(0);
    expect(
      await services.getRecentMatches({ ...input, viewerId: a }),
    ).toHaveLength(1);
    await db
      .update(users)
      .set({ historyVisibility: "friends" })
      .where(eq(users.id, a));
    expect(await services.getRecentMatches(input)).toHaveLength(0);
    expect(
      await services.getRecentMatches({ ...input, viewerId: outsider }),
    ).toHaveLength(0);
    expect(
      await services.getRecentMatches({ ...input, viewerId: b }),
    ).toHaveLength(1);
    await db
      .update(users)
      .set({ historyVisibility: "public" })
      .where(eq(users.id, a));
    expect(await services.getRecentMatches(input)).toHaveLength(1);
  });
  it("only host can invite accepted friends and repeated invitations deduplicate", async () => {
    await expect(
      features.invite(outsider, { recipientId: b, roomId }),
    ).rejects.toThrow();
    await expect(
      features.invite(b, { recipientId: a, roomId }),
    ).rejects.toThrow();
    const invited = await Promise.all(
      Array.from({ length: 5 }, () =>
        features.invite(a, { recipientId: b, roomId }),
      ),
    );
    expect(new Set(invited.map((x) => x.id)).size).toBe(1);
    expect(await features.inbox(b)).toHaveLength(1);
    await expect(
      features.respondInvitation(outsider, {
        id: invited[0]!.id,
        accept: true,
      }),
    ).rejects.toThrow();
    expect(
      await features.respondInvitation(b, { id: invited[0]!.id, accept: true }),
    ).toEqual({ roomId });
    await expect(
      features.respondInvitation(b, { id: invited[0]!.id, accept: true }),
    ).rejects.toThrow();
  });
  it("rechecks privacy/blocks/expiry before accepting and respects notification preferences", async () => {
    const prefs = await features.preferences(b);
    await features.updatePreferences(b, {
      ...prefs,
      notificationInvites: false,
    });
    const invite = await features.invite(a, { recipientId: b, roomId });
    expect(await features.inbox(b)).toHaveLength(1);
    await features.updatePreferences(b, {
      ...prefs,
      invitePermission: "nobody",
    });
    await expect(
      features.respondInvitation(b, { id: invite.id, accept: true }),
    ).rejects.toThrow();
    await features.updatePreferences(b, prefs);
    await db
      .update(lobbyInvitations)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(lobbyInvitations.id, invite.id));
    expect(
      (await features.invitations(b)).find((item) => item.id === invite.id)!
        .status,
    ).toBe("expired");
    await expect(
      features.respondInvitation(b, { id: invite.id, accept: true }),
    ).rejects.toThrow();
    await db.insert(userBlocks).values({ blockerId: b, blockedId: a });
    await expect(
      features.invite(a, { recipientId: b, roomId }),
    ).rejects.toThrow();
    await features.unblock(b, a);
    expect(await features.blocked(b)).toHaveLength(0);
  });
  it("read markers are scoped to the recipient", async () => {
    const [item] = await db
      .insert(notifications)
      .values({ userId: b, actorId: a, category: "friend_request" })
      .returning();
    await features.markRead(outsider, item!.id);
    const [stored] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, item!.id));
    expect(stored!.userId).toBe(b);
    expect(stored!.readAt).toBeNull();
    await features.markRead(b);
    expect((await features.inbox(b)).every((x) => x.readAt)).toBe(true);
  });
  it("lobby presets validate configs and cannot be modified across accounts", async () => {
    const saved = await features.savePreset(a, { name: "Two players", config });
    expect((await features.presets(a))[0]!.config).toEqual(config);
    await expect(
      features.savePreset(outsider, { id: saved.id, name: "Stolen", config }),
    ).rejects.toThrow();
    await features.deletePreset(outsider, saved.id);
    expect(await features.presets(a)).toHaveLength(1);
    await expect(
      features.savePreset(a, { name: "Bad", config: { ...config, size: 3 } }),
    ).rejects.toThrow();
  });
  it("privacy settings prevent messages and suppress presence", async () => {
    const prefs = await features.preferences(b);
    await features.updatePreferences(b, {
      ...prefs,
      messagePermission: "nobody",
      hidePresence: true,
    });
    await expect(services.sendDirectMessage(a, b, "blocked")).rejects.toThrow();
    await services.markPresence(b);
    expect(
      await db.select().from(userPresence).where(eq(userPresence.userId, b)),
    ).toHaveLength(0);
    await features.updatePreferences(b, prefs);
  });
  it("reports authorize context and only admins can review outcomes", async () => {
    await expect(
      features.report(outsider, {
        subjectId: b,
        reason: "cheating",
        details: "I did not play this match.",
        matchId,
      }),
    ).rejects.toThrow();
    const message = await services.sendDirectMessage(
      b,
      a,
      "Reportable message",
    );
    await expect(
      features.report(outsider, {
        subjectId: b,
        reason: "harassment",
        details: "Unowned message context.",
        messageId: message.id,
      }),
    ).rejects.toThrow();
    const report = await features.report(a, {
      subjectId: b,
      reason: "harassment",
      details: "Please review this message.",
      matchId,
      messageId: message.id,
    });
    expect(await features.reports(outsider, false)).toHaveLength(0);
    await expect(
      features.reviewReport(outsider, {
        id: report.id,
        status: "resolved",
        resolution: "done",
      }),
    ).rejects.toThrow();
    await features.reviewReport(admin, {
      id: report.id,
      status: "resolved",
      resolution: "Reviewed by moderator.",
    });
    expect((await features.reports(a, false))[0]!.status).toBe("resolved");
  });
  it("achievements derive from persisted participation and export excludes auth secrets", async () => {
    expect(
      (await features.achievements(a)).find((x) => x.id === "first-win")!
        .unlocked,
    ).toBe(true);
    const exported = await features.exportData(a);
    expect(exported.presets).toHaveLength(1);
    expect(exported.matchParticipation).toHaveLength(1);
    expect(exported.reports).toHaveLength(1);
    expect(JSON.stringify(exported)).not.toContain("passwordHash");
    expect(JSON.stringify(exported)).not.toContain("refreshHash");
  });
  it("failed lobby shutdown preserves the account and ownership for retry", async () => {
    const room = `custom-${crypto.randomUUID()}`;
    await db.insert(customLobbies).values({
      roomId: room,
      ownerId: outsider,
      config: JSON.stringify(config),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Unavailable", { status: 503 })),
    );
    await expect(features.deleteAccount(outsider, "DELETE")).rejects.toThrow(
      "Unable to close your lobbies",
    );
    const [user] = await db.select().from(users).where(eq(users.id, outsider));
    expect(user!.deletedAt).toBeNull();
    expect(
      await db
        .select()
        .from(customLobbies)
        .where(eq(customLobbies.roomId, room)),
    ).toHaveLength(1);
    vi.unstubAllGlobals();
  });
  it("deletion retains shared match results with identity anonymized and revokes owned surfaces", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    await features.deleteAccount(a, "DELETE");
    expect(fetch).toHaveBeenCalledOnce();
    const [user] = await db.select().from(users).where(eq(users.id, a));
    expect(user!.accountStatus).toBe("deleted");
    expect(user!.name).toBe("Deleted player");
    expect(user!.authVersion).toBeGreaterThan(0);
    const participants = await db
      .select()
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, matchId));
    expect(
      participants.find((p) => p.username === "Deleted player")!.userId,
    ).toBeNull();
    expect(participants.find((p) => p.userId === b)!.role).toBe("Mafia");
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId));
    expect(match!.conversationHistory).not.toContain("Feature Alice");
    expect(
      await db.select().from(customLobbies).where(eq(customLobbies.ownerId, a)),
    ).toHaveLength(0);
    expect(
      await db.select().from(lobbyPresets).where(eq(lobbyPresets.userId, a)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(directMessages)
        .where(eq(directMessages.senderId, b)),
    ).toHaveLength(0);
  });
  it("late completed-match uploads cannot restore a deleted account identity", async () => {
    const saved = await services.persistMatch({
      gameId: `${prefix}-late`,
      roomName: prefix,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      winningFaction: "Town",
      winningRoles: ["Doctor"],
      participants: [
        { userId: a, username: "Feature Alice", role: "Doctor", won: true },
        { userId: b, username: "Feature Bob", role: "Mafia", won: false },
      ],
      conversationHistory: [
        {
          time: 1,
          type: "chat",
          actor: "Feature Alice",
          content: "private words",
        },
        { time: 2, type: "system", content: "Feature Alice joined the game." },
      ],
      actionHistory: [],
    });
    const rows = await db
      .select()
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, saved.id));
    expect(
      rows.find((r) => r.username === "Deleted player")!.userId,
    ).toBeNull();
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, saved.id));
    expect(match!.conversationHistory).not.toContain("Feature Alice");
  });
});
