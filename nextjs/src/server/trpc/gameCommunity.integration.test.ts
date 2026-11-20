import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "~/server/db";
import {
  users,
  matches,
  matchParticipants,
  userBlocks,
  replayAnnotations,
} from "@mernmafia/db/schema";
import { gameCommunityServices as service } from "./gameCommunity";
import { lobbyConfigSchema } from "@mernmafia/shared/game/lobbyConfig";
import {
  createGamePack,
  encodeGamePack,
} from "@mernmafia/shared/game/gameCustomization";
let ids: string[], a: string, b: string, c: string, matchId: number;
beforeEach(async () => {
  ids = Array.from({ length: 3 }, () => crypto.randomUUID());
  [a, b, c] = ids as [string, string, string];
  await db.insert(users).values(
    ids.map((id, n) => ({
      id,
      email: `${id}@test.invalid`,
      name: `Player ${n}`,
    })),
  );
  const [match] = await db
    .insert(matches)
    .values({
      roomName: "Campaign test",
      startedAt: new Date(Date.now() - 10000),
      endedAt: new Date(Date.now() - 1000),
      winningFaction: "Town",
      winningRoles: "[]",
      playerCount: 2,
      actionHistory: JSON.stringify([
        { type: "system", time: 1, content: "Round begins" },
      ]),
      conversationHistory: JSON.stringify([
        {
          type: "whisper",
          time: 2,
          actor: "A",
          target: "B",
          content: "private",
        },
      ]),
    })
    .returning();
  matchId = match!.id;
  await db.insert(matchParticipants).values([
    { matchId, userId: a, username: "A", role: "Doctor", won: true },
    { matchId, userId: b, username: "B", role: "Mafia", won: false },
  ]);
});
afterEach(async () => {
  await db.delete(matches).where(eq(matches.id, matchId));
  await db.delete(users).where(inArray(users.id, ids));
});
afterAll(() => db.$client.end());
describe("private campaigns", () => {
  it("keeps one replaceable, validated setup vote per campaign member", async () => {
    const group = await service.create(a, { name: "Setup vote" });
    const config = lobbyConfigSchema.parse({
      size: 4,
      roleSelection: {
        algorithm: "weighted-random",
        roles: [{ role: "doctor" }, { role: "mafia", minimum: 1 }],
      },
    });
    const first = encodeGamePack(createGamePack("Classic", config));
    const replacement = encodeGamePack(createGamePack("Fast night", config));
    await service.voteSetup(a, { campaignId: group.id, packCode: first });
    const result = await service.voteSetup(a, {
      campaignId: group.id,
      packCode: replacement,
    });
    expect(result.votes).toEqual([{ userId: a, packCode: replacement }]);
    await expect(
      service.voteSetup(c, { campaignId: group.id, packCode: first }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("serializes concurrent joins and round submissions without duplicate membership or scores", async () => {
    const group = await service.create(a, { name: "Concurrent game night" });
    await Promise.all(
      Array.from({ length: 4 }, () =>
        service.join(b, { shareCode: group.shareCode }),
      ),
    );
    await Promise.all(
      Array.from({ length: 4 }, () =>
        service.addRound(a, { campaignId: group.id, matchId }),
      ),
    );
    const result = await service.detail(b, { campaignId: group.id });
    expect(result.members).toHaveLength(2);
    expect(result.rounds).toHaveLength(1);
    expect(result.scoreboard.find((score) => score.userId === a)?.games).toBe(
      1,
    );
    expect(await service.list(c)).toEqual([]);
  });
  it("shares membership by private code, rejects outsiders, rotates host and scores verified rounds", async () => {
    const group = await service.create(a, { name: "Friday" });
    expect(group.canManage).toBe(true);
    await expect(
      service.detail(c, { campaignId: group.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const joined = await service.join(b, { shareCode: group.shareCode });
    expect(joined.members).toHaveLength(2);
    expect(joined.canManage).toBe(false);
    await expect(
      service.rotateHost(b, { campaignId: group.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const scored = await service.addRound(a, { campaignId: group.id, matchId });
    expect(scored.scoreboard.find((s) => s.userId === a)).toMatchObject({
      games: 1,
      wins: 1,
      draws: 0,
    });
    await service.addRound(a, { campaignId: group.id, matchId });
    expect(
      (await service.detail(a, { campaignId: group.id })).rounds,
    ).toHaveLength(1);
    const rotated = await service.rotateHost(a, { campaignId: group.id });
    expect(rotated.hostId).toBe(b);
    await service.join(c, { shareCode: group.shareCode });
    await service.rotateHost(b, { campaignId: group.id });
    await expect(
      service.addRound(c, { campaignId: group.id, matchId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("blocks joins across blocked relationships and validates share packs", async () => {
    const group = await service.create(a, { name: "Private" });
    await db.insert(userBlocks).values({ blockerId: a, blockedId: b });
    await expect(
      service.join(b, { shareCode: group.shareCode }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.voteSetup(a, { campaignId: group.id, packCode: "not-a-pack" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
describe("participant discussions", () => {
  it("enforces the discussion cap across concurrent writers", async () => {
    await db.insert(replayAnnotations).values(
      Array.from({ length: 199 }, () => ({
        id: crypto.randomUUID(),
        matchId,
        authorId: a,
        eventIndex: 0,
        text: "Earlier annotation",
      })),
    );
    const results = await Promise.allSettled(
      [a, b].map((userId) =>
        service.annotate(userId, {
          matchId,
          eventIndex: 0,
          text: "Final annotation",
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect((await service.discussion(a, { matchId })).annotations).toHaveLength(
      200,
    );
  });
  it("allows public event annotations with author ownership and denies whispers and outsiders", async () => {
    await expect(service.discussion(c, { matchId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      service.annotate(a, { matchId, eventIndex: 1, text: "Whisper" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await service.annotate(a, {
      matchId,
      eventIndex: 0,
      text: "Decisive discussion",
    });
    const discussion = await service.discussion(b, { matchId });
    expect(discussion.annotations).toHaveLength(1);
    expect(discussion.participants).toHaveLength(2);
    const annotationId = discussion.annotations[0]!.id;
    await expect(
      service.deleteAnnotation(b, { matchId, annotationId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await service.deleteAnnotation(a, { matchId, annotationId });
    expect((await service.discussion(a, { matchId })).annotations).toEqual([]);
  });
  it("accepts one replaceable nomination per participant and rejects nonplayers or live matches", async () => {
    await expect(
      service.nominate(a, { matchId, nomineeId: c, eventIndex: 0 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await service.nominate(a, { matchId, nomineeId: b, eventIndex: 0 });
    await service.nominate(a, { matchId, nomineeId: a, eventIndex: 0 });
    expect((await service.discussion(a, { matchId })).nominations).toEqual([
      { userId: a, nomineeId: a, eventIndex: 0 },
    ]);
    await db
      .update(matches)
      .set({ endedAt: new Date(Date.now() + 60000) })
      .where(eq(matches.id, matchId));
    await expect(service.discussion(a, { matchId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
