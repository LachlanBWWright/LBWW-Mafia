import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  users,
  friendships,
  partyInvitations,
  partyMembers,
  customLobbies,
  userBlocks,
} from "@mernmafia/db/schema";
import { MAX_PARTY_MEMBERS } from "@mernmafia/shared/trpc/parties";
import { db } from "~/server/db";
import { exportPartyData, partyServices as service } from "./parties";
let ids: string[];
let a: string, b: string, c: string, outsider: string, room: string;
beforeEach(async () => {
  const prefix = crypto.randomUUID();
  ids = Array.from(
    { length: MAX_PARTY_MEMBERS + 2 },
    (_, n) => `${prefix}-${n}`,
  );
  [a, b, c, outsider] = ids as [string, string, string, string];
  room = `party-${prefix}`;
  await db.insert(users).values(
    ids.map((id, n) => ({
      id,
      email: `${id}@test.invalid`,
      name: `Party ${n}`,
    })),
  );
  await db
    .insert(friendships)
    .values(
      ids
        .slice(1)
        .map((id) => ({ requesterId: a, addresseeId: id, status: "accepted" })),
    );
  await db
    .insert(customLobbies)
    .values({ roomId: room, ownerId: a, config: "{}" });
});
afterEach(async () => {
  await db.delete(users).where(inArray(users.id, ids));
});
afterAll(async () => {
  await db.$client.end({ timeout: 1 });
});

async function add(leader: string, target: string) {
  const invite = await service.invite(leader, { recipientId: target });
  return service.respond(target, { id: invite.id, accept: true });
}

describe("persistent party membership and authorization", () => {
  it("creates one party under concurrent retries and keeps destination across reads", async () => {
    const groups = await Promise.all(
      Array.from({ length: 5 }, () => service.create(a)),
    );
    expect(new Set(groups.map((p) => p.id)).size).toBe(1);
    expect(groups[0]?.members).toHaveLength(1);
    await add(a, b);
    await service.move(a, { roomId: room });
    expect((await service.current(b))?.roomId).toBe(room);
    expect(await service.current(outsider)).toBeNull();
    expect(
      await db
        .select()
        .from(partyMembers)
        .where(eq(partyMembers.partyId, groups[0]!.id)),
    ).toHaveLength(2);
  });
  it("exports only own membership and invitations without other player identities", async () => {
    await service.create(a);
    await add(a, b);
    await service.invite(a, { recipientId: c });
    const data = await exportPartyData(b);
    expect(data.membership).toMatchObject([{ isLeader: false }]);
    expect(data.invitations).toMatchObject([
      { direction: "received", status: "accepted" },
    ]);
    expect(JSON.stringify(data)).not.toContain(a);
    expect(JSON.stringify(data)).not.toContain(c);
    expect(await exportPartyData(outsider)).toEqual({
      membership: [],
      invitations: [],
    });
  });
  it("restricts invitations, leadership and destinations to authorized members", async () => {
    await service.create(a);
    await add(a, b);
    await expect(service.invite(b, { recipientId: c })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(service.move(b, { roomId: room })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      service.move(outsider, { roomId: room }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      service.move(a, { roomId: "missing-room" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.kick(a, { userId: outsider })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await service.transfer(a, { userId: b });
    await expect(service.kick(a, { userId: b })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await service.kick(b, { userId: a });
    expect(await service.current(a)).toBeNull();
  });
  it("protects recipient, expiry, changed invitation preferences and either-way blocks", async () => {
    await service.create(a);
    const invite = await service.invite(a, { recipientId: b });
    await expect(
      service.respond(c, { id: invite.id, accept: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await service.invitations(c)).toEqual([]);
    await db
      .update(users)
      .set({ invitePermission: "nobody" })
      .where(eq(users.id, b));
    await expect(
      service.respond(b, { id: invite.id, accept: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db
      .update(users)
      .set({ invitePermission: "friends" })
      .where(eq(users.id, b));
    for (const [blockerId, blockedId] of [
      [a, b],
      [b, a],
    ] as const) {
      await db.insert(userBlocks).values({ blockerId, blockedId });
      await expect(
        service.respond(b, { id: invite.id, accept: true }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await service.invitations(b)).toEqual([]);
      await db.delete(userBlocks).where(eq(userBlocks.blockerId, blockerId));
    }
    await db
      .update(partyInvitations)
      .set({ expiresAt: new Date(0) })
      .where(eq(partyInvitations.id, invite.id));
    expect(await service.invitations(b)).toEqual([]);
    await expect(
      service.respond(b, { id: invite.id, accept: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await service.current(b)).toBeNull();
  });
  it("deduplicates concurrent invites and permits exactly one of two simultaneous memberships", async () => {
    await service.create(a);
    await service.create(c);
    await db
      .insert(friendships)
      .values({ requesterId: c, addresseeId: b, status: "accepted" });
    const invites = await Promise.all(
      Array.from({ length: 4 }, () => service.invite(a, { recipientId: b })),
    );
    expect(new Set(invites.map((v) => v.id)).size).toBe(1);
    const second = await service.invite(c, { recipientId: b });
    const responses = await Promise.allSettled([
      service.respond(b, { id: invites[0]!.id, accept: true }),
      service.respond(b, { id: second.id, accept: true }),
    ]);
    expect(responses.filter((v) => v.status === "fulfilled")).toHaveLength(1);
    expect(
      await db.select().from(partyMembers).where(eq(partyMembers.userId, b)),
    ).toHaveLength(1);
  });
  it("checks blocked peers when accepting and transfers leadership when the leader leaves", async () => {
    await service.create(a);
    await add(a, b);
    const invitation = await service.invite(a, { recipientId: c });
    await db.insert(userBlocks).values({ blockerId: b, blockedId: c });
    await expect(
      service.respond(c, { id: invitation.id, accept: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await service.leave(a);
    expect((await service.current(b))?.leaderId).toBe(b);
    expect(await service.invitations(c)).toEqual([]);
    await service.leave(b);
    expect(await service.current(b)).toBeNull();
  });
  it("enforces capacity at acceptance when invitations race for the final place", async () => {
    await service.create(a);
    for (const target of ids.slice(1, MAX_PARTY_MEMBERS - 1))
      await add(a, target);
    const x = ids[MAX_PARTY_MEMBERS - 1]!,
      y = ids[MAX_PARTY_MEMBERS]!;
    const ix = await service.invite(a, { recipientId: x }),
      iy = await service.invite(a, { recipientId: y });
    const responses = await Promise.allSettled([
      service.respond(x, { id: ix.id, accept: true }),
      service.respond(y, { id: iy.id, accept: true }),
    ]);
    expect(responses.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await service.current(a))?.members).toHaveLength(MAX_PARTY_MEMBERS);
    await expect(
      service.invite(a, { recipientId: ids[MAX_PARTY_MEMBERS + 1]! }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
