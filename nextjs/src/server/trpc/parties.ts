import { TRPCError } from "@trpc/server";
import { and, asc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import {
  activeRoom,
  customLobbies,
  friendships,
  parties,
  partyInvitations,
  partyMembers,
  users,
} from "@mernmafia/db/schema";
import {
  MAX_PARTY_MEMBERS,
  PARTY_INVITATION_TTL_MS,
  type PartyServices,
  type PartySummary,
} from "@mernmafia/shared/trpc/parties";
import { db } from "~/server/db";
import { canInteractWithUser } from "./services/presence";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const forbidden = (message = "This party action is unavailable.") =>
  new TRPCError({ code: "FORBIDDEN", message });

async function lockUsers(tx: Tx, ids: string[]) {
  const unique = [...new Set(ids)].sort();
  const rows = await tx
    .select()
    .from(users)
    .where(inArray(users.id, unique))
    .orderBy(users.id)
    .for("update");
  if (
    rows.length !== unique.length ||
    rows.some((u) => u.deletedAt !== null || u.accountStatus !== "active")
  )
    throw forbidden("The player account is unavailable.");
  return rows;
}
async function membership(tx: Tx | typeof db, userId: string) {
  const [member] = await tx
    .select()
    .from(partyMembers)
    .where(eq(partyMembers.userId, userId));
  return member;
}
async function lockParty(tx: Tx, userId: string, leaderOnly = false) {
  const member = await membership(tx, userId);
  if (!member) throw forbidden("You are not in a party.");
  const [party] = await tx
    .select()
    .from(parties)
    .where(eq(parties.id, member.partyId))
    .for("update");
  if (!party || (leaderOnly && party.leaderId !== userId))
    throw forbidden("Only the party leader can do that.");
  return party;
}
async function summary(
  tx: Tx | typeof db,
  userId: string,
): Promise<PartySummary | null> {
  const member = await membership(tx, userId);
  if (!member) return null;
  const [party] = await tx
    .select()
    .from(parties)
    .where(eq(parties.id, member.partyId));
  if (!party) return null;
  const members = await tx
    .select({
      userId: partyMembers.userId,
      name: users.name,
      handle: users.handle,
      joinedAt: partyMembers.joinedAt,
    })
    .from(partyMembers)
    .innerJoin(users, eq(users.id, partyMembers.userId))
    .where(eq(partyMembers.partyId, party.id))
    .orderBy(asc(partyMembers.joinedAt), asc(partyMembers.userId));
  return { ...party, members };
}
async function checkInvitation(tx: Tx, senderId: string, recipientId: string) {
  if (senderId === recipientId) throw forbidden("You cannot invite yourself.");
  const [recipient] = await tx
    .select()
    .from(users)
    .where(eq(users.id, recipientId));
  if (
    !recipient ||
    recipient.deletedAt ||
    recipient.accountStatus !== "active" ||
    recipient.invitePermission === "nobody"
  )
    throw forbidden("This player is not accepting invitations.");
  const [friend] = await tx
    .select()
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(
          and(
            eq(friendships.requesterId, senderId),
            eq(friendships.addresseeId, recipientId),
          ),
          and(
            eq(friendships.requesterId, recipientId),
            eq(friendships.addresseeId, senderId),
          ),
        ),
      ),
    );
  if (!friend || !(await canInteractWithUser(senderId, recipientId, tx)))
    throw forbidden("Party invitations are available between friends.");
}
async function invalidateInvites(tx: Tx, partyId: string) {
  await tx
    .update(partyInvitations)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(partyInvitations.partyId, partyId),
        eq(partyInvitations.status, "pending"),
      ),
    );
}

/** Exports only the account's own records, without other members' identities. */
export async function exportPartyData(
  userId: string,
  executor: Tx | typeof db = db,
) {
  const [membershipRows, invitations] = await Promise.all([
    executor
      .select({
        partyId: partyMembers.partyId,
        joinedAt: partyMembers.joinedAt,
        leaderId: parties.leaderId,
        roomId: parties.roomId,
        updatedAt: parties.updatedAt,
      })
      .from(partyMembers)
      .innerJoin(parties, eq(parties.id, partyMembers.partyId))
      .where(eq(partyMembers.userId, userId)),
    executor
      .select({
        id: partyInvitations.id,
        partyId: partyInvitations.partyId,
        senderId: partyInvitations.senderId,
        status: partyInvitations.status,
        createdAt: partyInvitations.createdAt,
        expiresAt: partyInvitations.expiresAt,
      })
      .from(partyInvitations)
      .where(
        or(
          eq(partyInvitations.senderId, userId),
          eq(partyInvitations.recipientId, userId),
        ),
      )
      .orderBy(asc(partyInvitations.createdAt)),
  ]);
  return {
    membership: membershipRows.map(({ leaderId, ...own }) => ({
      ...own,
      isLeader: leaderId === userId,
    })),
    invitations: invitations.map(({ senderId, ...own }) => ({
      ...own,
      direction:
        senderId === userId ? ("sent" as const) : ("received" as const),
    })),
  };
}

/** Used inside account deletion transactions after the account row is locked. */
export async function removePartyMembership(tx: Tx, userId: string) {
  if (!(await membership(tx, userId))) return;
  const party = await lockParty(tx, userId);
  await tx.delete(partyMembers).where(eq(partyMembers.userId, userId));
  const [next] = await tx
    .select()
    .from(partyMembers)
    .where(eq(partyMembers.partyId, party.id))
    .orderBy(asc(partyMembers.joinedAt), asc(partyMembers.userId));
  if (!next) await tx.delete(parties).where(eq(parties.id, party.id));
  else {
    await tx
      .update(parties)
      .set({
        leaderId: party.leaderId === userId ? next.userId : party.leaderId,
        updatedAt: new Date(),
      })
      .where(eq(parties.id, party.id));
    if (party.leaderId === userId) await invalidateInvites(tx, party.id);
  }
}

export const partyServices: PartyServices = {
  current: (userId) => summary(db, userId),
  async invitations(userId) {
    const rows = await db
      .select({
        id: partyInvitations.id,
        partyId: partyInvitations.partyId,
        senderId: partyInvitations.senderId,
        senderName: users.name,
        expiresAt: partyInvitations.expiresAt,
      })
      .from(partyInvitations)
      .innerJoin(users, eq(users.id, partyInvitations.senderId))
      .innerJoin(
        parties,
        and(
          eq(parties.id, partyInvitations.partyId),
          eq(parties.leaderId, partyInvitations.senderId),
        ),
      )
      .where(
        and(
          eq(partyInvitations.recipientId, userId),
          eq(partyInvitations.status, "pending"),
          gt(partyInvitations.expiresAt, new Date()),
          isNull(users.deletedAt),
          eq(users.accountStatus, "active"),
        ),
      )
      .orderBy(asc(partyInvitations.createdAt))
      .limit(100);
    const visible = await Promise.all(
      rows.map(async (row) =>
        (await canInteractWithUser(userId, row.senderId)) ? row : null,
      ),
    );
    return visible.filter(
      (row): row is NonNullable<typeof row> => row !== null,
    );
  },
  async create(userId) {
    return db.transaction(async (tx) => {
      await lockUsers(tx, [userId]);
      const existing = await summary(tx, userId);
      if (existing) return existing;
      const id = crypto.randomUUID();
      await tx.insert(parties).values({ id, leaderId: userId });
      await tx.insert(partyMembers).values({ partyId: id, userId });
      return (await summary(tx, userId))!;
    });
  },
  async invite(userId, { recipientId }) {
    return db.transaction(async (tx) => {
      const accounts = await lockUsers(tx, [userId, recipientId]);
      const party = await lockParty(tx, userId, true);
      await checkInvitation(tx, userId, recipientId);
      if (await membership(tx, recipientId))
        throw forbidden("This player is already in a party.");
      const members = await tx
        .select()
        .from(partyMembers)
        .where(eq(partyMembers.partyId, party.id));
      if (members.length >= MAX_PARTY_MEMBERS)
        throw forbidden("The party is full.");
      const [existing] = await tx
        .select()
        .from(partyInvitations)
        .where(
          and(
            eq(partyInvitations.partyId, party.id),
            eq(partyInvitations.recipientId, recipientId),
            eq(partyInvitations.status, "pending"),
            gt(partyInvitations.expiresAt, new Date()),
          ),
        );
      const [created] = existing
        ? [existing]
        : await tx
            .insert(partyInvitations)
            .values({
              partyId: party.id,
              senderId: userId,
              recipientId,
              expiresAt: new Date(Date.now() + PARTY_INVITATION_TTL_MS),
            })
            .returning();
      if (!created) throw new Error("Party invitation creation failed");
      return {
        id: created.id,
        partyId: created.partyId,
        senderId: userId,
        senderName: accounts.find((u) => u.id === userId)?.name ?? null,
        expiresAt: created.expiresAt,
      };
    });
  },
  async respond(userId, { id, accept }) {
    return db.transaction(async (tx) => {
      const [candidate] = await tx
        .select()
        .from(partyInvitations)
        .where(
          and(
            eq(partyInvitations.id, id),
            eq(partyInvitations.recipientId, userId),
          ),
        );
      if (!candidate) throw forbidden();
      await lockUsers(tx, [userId, candidate.senderId]);
      const [party] = await tx
        .select()
        .from(parties)
        .where(eq(parties.id, candidate.partyId))
        .for("update");
      const [invitation] = await tx
        .select()
        .from(partyInvitations)
        .where(eq(partyInvitations.id, id))
        .for("update");
      if (
        party?.leaderId !== candidate.senderId ||
        invitation?.status !== "pending" ||
        invitation.expiresAt <= new Date()
      )
        throw forbidden("This invitation is no longer available.");
      if (accept) {
        await checkInvitation(tx, candidate.senderId, userId);
        if (await membership(tx, userId))
          throw forbidden("Leave your current party first.");
        const members = await tx
          .select()
          .from(partyMembers)
          .where(eq(partyMembers.partyId, party.id));
        if (members.length >= MAX_PARTY_MEMBERS)
          throw forbidden("The party is full.");
        for (const member of members)
          if (!(await canInteractWithUser(member.userId, userId, tx)))
            throw forbidden("You cannot join a party with a blocked player.");
        await tx.insert(partyMembers).values({ partyId: party.id, userId });
        await tx
          .update(parties)
          .set({ updatedAt: new Date() })
          .where(eq(parties.id, party.id));
      }
      await tx
        .update(partyInvitations)
        .set({ status: accept ? "accepted" : "declined" })
        .where(eq(partyInvitations.id, id));
      return accept ? summary(tx, userId) : null;
    });
  },
  async leave(userId) {
    await db.transaction(async (tx) => {
      await lockUsers(tx, [userId]);
      await removePartyMembership(tx, userId);
    });
  },
  async kick(userId, { userId: target }) {
    await db.transaction(async (tx) => {
      await lockUsers(tx, [userId, target]);
      const party = await lockParty(tx, userId, true);
      if (
        target === userId ||
        (await membership(tx, target))?.partyId !== party.id
      )
        throw forbidden("Choose another party member.");
      await tx.delete(partyMembers).where(eq(partyMembers.userId, target));
      await tx
        .update(parties)
        .set({ updatedAt: new Date() })
        .where(eq(parties.id, party.id));
    });
  },
  async transfer(userId, { userId: target }) {
    await db.transaction(async (tx) => {
      await lockUsers(tx, [userId, target]);
      const party = await lockParty(tx, userId, true);
      if ((await membership(tx, target))?.partyId !== party.id)
        throw forbidden("Choose a party member.");
      await tx
        .update(parties)
        .set({ leaderId: target, updatedAt: new Date() })
        .where(eq(parties.id, party.id));
      await invalidateInvites(tx, party.id);
    });
  },
  async move(userId, { roomId }) {
    await db.transaction(async (tx) => {
      await lockUsers(tx, [userId]);
      const party = await lockParty(tx, userId, true);
      const [custom] = await tx
        .select()
        .from(customLobbies)
        .where(eq(customLobbies.roomId, roomId));
      const [current] = await tx
        .select()
        .from(activeRoom)
        .where(eq(activeRoom.roomId, roomId));
      if (!custom && !current) throw forbidden("Choose an available lobby.");
      await tx
        .update(parties)
        .set({ roomId, updatedAt: new Date() })
        .where(eq(parties.id, party.id));
    });
  },
};
