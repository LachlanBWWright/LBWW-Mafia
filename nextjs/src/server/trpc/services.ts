import { partyServices } from "./parties";
import { matchAnalysisServices } from "./matchAnalysis";
import { anonymizeHistory } from "@mernmafia/shared/game/accountAnonymization";
import {
  accountFeatureServices,
  emitAccountNotification,
} from "./accountFeatures";
import { listDeviceSessions, revokeDeviceSession } from "../auth/mobileToken";
import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  like,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db } from "~/server/db";
import {
  activeRoom,
  auditLogs,
  directConversationMembers,
  directConversations,
  directMessages,
  friendships,
  matchParticipants,
  matches,
  userBlocks,
  userRoles,
  users,
} from "@mernmafia/db/schema";
import type {
  MatchParticipantSummary,
  DirectConversationSummary,
  DirectMessage,
  PersistMatchInput,
  RecentMatchSummary,
  RouterServices,
  SocialUser,
} from "@mernmafia/shared/trpc/appRouter";
import {
  deserializeEventHistory,
  deserializeStringArray,
} from "@mernmafia/shared/trpc/validators";

import {
  canInteractWithUser,
  getPresenceMap,
  isOnline,
  markPresence,
} from "./services/presence";
import { getRelationshipMap } from "./services/community";
import * as accountServices from "./services/account";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function lockPair(tx: Transaction, first: string, second: string) {
  const ids = [first, second].sort();
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify(ids)}, 0))`,
  );
  // Account suspension/deletion uses the same row locks held until the send commits.
  await tx
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, ids))
    .orderBy(users.id)
    .for("update");
}
async function pairTransaction<T>(
  first: string,
  second: string,
  work: (tx: Transaction) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    await lockPair(tx, first, second);
    return work(tx);
  });
}

type MatchRow = {
  id: number;
  roomName: string;
  endedAt: Date;
  winningFaction: string;
  winningRoles: string;
  conversationHistory: string;
  actionHistory: string;
};

/**
 * Fetches participants for a list of match IDs.
 * Returns a map of match ID to its participants.
 *
 * @param matchIds - Array of match IDs to fetch participants for
 * @returns Map of match ID to participants
 */
const getParticipantsByMatchIds = async (
  matchIds: number[],
): Promise<Map<number, MatchParticipantSummary[]>> => {
  if (matchIds.length === 0) {
    return new Map();
  }

  const participantRows = await db
    .select({
      matchId: matchParticipants.matchId,
      username: matchParticipants.username,
      role: matchParticipants.role,
      won: matchParticipants.won,
    })
    .from(matchParticipants)
    .where(inArray(matchParticipants.matchId, matchIds));

  const participantMap = new Map<number, MatchParticipantSummary[]>();
  for (const participant of participantRows) {
    const current = participantMap.get(participant.matchId) ?? [];
    current.push({
      username: participant.username,
      role: participant.role,
      won: participant.won,
    });
    participantMap.set(participant.matchId, current);
  }

  return participantMap;
};

/**
 * Retrieves recent matches for a specific username.
 * Returns matches ordered by most recent first, deduplicated by match ID.
 *
 * @param options - Options object
 * @param options .username - Username to fetch matches for
 * @param options .limit - Maximum number of matches to return
 * @returns Recent matches with participant info
 */
const getRecentMatches = async ({
  username,
  limit,
  viewerId,
}: {
  username: string;
  limit: number;
  viewerId?: string;
}): Promise<RecentMatchSummary[]> => {
  const normalizedUsername = username.trim();
  if (!normalizedUsername) {
    return [];
  }

  const recentRows = await db
    .select({
      id: matches.id,
      roomName: matches.roomName,
      endedAt: matches.endedAt,
      winningFaction: matches.winningFaction,
      winningRoles: matches.winningRoles,
      conversationHistory: matches.conversationHistory,
      actionHistory: matches.actionHistory,
    })
    .from(matches)
    .innerJoin(matchParticipants, eq(matchParticipants.matchId, matches.id))
    .leftJoin(users, eq(users.id, matchParticipants.userId))
    .where(
      and(
        normalizedUsername.startsWith("user:")
          ? eq(matchParticipants.userId, normalizedUsername.slice(5))
          : eq(matchParticipants.username, normalizedUsername),
        or(
          isNull(matchParticipants.userId),
          eq(users.historyVisibility, "public"),
          viewerId ? eq(matchParticipants.userId, viewerId) : undefined,
          viewerId
            ? and(
                eq(users.historyVisibility, "friends"),
                sql`exists (select 1 from ${friendships} where ${friendships.status} = 'accepted' and ((${friendships.requesterId} = ${viewerId} and ${friendships.addresseeId} = ${users.id}) or (${friendships.addresseeId} = ${viewerId} and ${friendships.requesterId} = ${users.id})))`,
              )
            : undefined,
        ),
      ),
    )
    .orderBy(desc(matches.endedAt))
    .limit(limit);

  const dedupedById = new Map<number, MatchRow>();
  for (const row of recentRows) {
    if (!dedupedById.has(row.id)) {
      dedupedById.set(row.id, {
        id: row.id,
        roomName: row.roomName,
        endedAt: row.endedAt,
        winningFaction: row.winningFaction,
        winningRoles: row.winningRoles,
        conversationHistory: row.conversationHistory,
        actionHistory: row.actionHistory,
      });
    }
  }

  const uniqueRows = Array.from(dedupedById.values()).slice(0, limit);
  const participantMap = await getParticipantsByMatchIds(
    uniqueRows.map((row) => row.id),
  );

  return uniqueRows.map((row) => ({
    id: row.id,
    roomName: row.roomName,
    endedAt: row.endedAt,
    winningFaction: row.winningFaction,
    winningRoles: deserializeStringArray(row.winningRoles),
    participants: participantMap.get(row.id) ?? [],
    conversationCount: deserializeEventHistory(row.conversationHistory).length,
    actionCount: deserializeEventHistory(row.actionHistory).length,
  }));
};

const searchCommunity: RouterServices["searchCommunity"] = async (
  userId,
  query,
) => {
  const filter = query
    ? or(like(users.name, `%${query}%`), like(users.handle, `%${query}%`))
    : undefined;
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      handle: users.handle,
      image: users.image,
      avatarPreset: users.avatarPreset,
      profileVisibility: users.profileVisibility,
    })
    .from(users)
    .where(
      and(
        ne(users.id, userId),
        eq(users.accountStatus, "active"),
        isNull(users.deletedAt),
        filter,
      ),
    )
    .limit(25);
  const idsForRelationships = rows.map((row) => row.id);
  const [presence, relationships] = await Promise.all([
    getPresenceMap(idsForRelationships),
    getRelationshipMap(userId, idsForRelationships),
  ]);
  return Promise.all(
    rows
      .filter(
        (row) =>
          row.profileVisibility === "public" ||
          (row.profileVisibility === "friends" &&
            relationships.get(row.id) === "friend"),
      )
      .map(async (row) => ({
        ...row,
        relationship: relationships.get(row.id) ?? "none",
        isOnline:
          relationships.get(row.id) !== "blocked" &&
          isOnline(presence.get(row.id)),
        lastSeenAt:
          relationships.get(row.id) === "blocked"
            ? null
            : (presence.get(row.id) ?? null),
      })),
  );
};

const listFriends: RouterServices["listFriends"] = async (userId) => {
  const relations = await db
    .select()
    .from(friendships)
    .where(
      or(
        eq(friendships.requesterId, userId),
        eq(friendships.addresseeId, userId),
      ),
    );
  const ids = relations.map((row) =>
    row.requesterId === userId ? row.addresseeId : row.requesterId,
  );
  if (!ids.length) return [];
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      handle: users.handle,
      image: users.image,
      avatarPreset: users.avatarPreset,
    })
    .from(users)
    .where(
      and(
        inArray(users.id, ids),
        eq(users.accountStatus, "active"),
        isNull(users.deletedAt),
      ),
    );
  const idsForRelationships = rows.map((row) => row.id);
  const [presence, relationships] = await Promise.all([
    getPresenceMap(idsForRelationships),
    getRelationshipMap(userId, idsForRelationships),
  ]);
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      relationship: relationships.get(row.id) ?? "none",
      isOnline: isOnline(presence.get(row.id)),
      lastSeenAt: presence.get(row.id) ?? null,
    })),
  );
};

const requestFriend: RouterServices["requestFriend"] = async (
  userId,
  addresseeId,
) => {
  return pairTransaction(userId, addresseeId, async (tx) => {
    if (userId === addresseeId) throw new Error("You cannot add yourself");
    const [target] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, addresseeId))
      .limit(1);
    if (!target) throw new Error("User not found");
    if (!(await canInteractWithUser(userId, addresseeId, tx)))
      throw new Error("You cannot interact with this user");
    const created = await tx
      .insert(friendships)
      .values({ requesterId: userId, addresseeId })
      .onConflictDoNothing()
      .returning({ requesterId: friendships.requesterId });
    if (created.length)
      await emitAccountNotification(tx, {
        userId: addresseeId,
        actorId: userId,
        category: "friend_request",
      });
  });
};
const removeFriend: RouterServices["removeFriend"] = async (
  userId,
  otherId,
) => {
  return pairTransaction(userId, otherId, async (tx) => {
    await tx
      .delete(friendships)
      .where(
        or(
          and(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, otherId),
          ),
          and(
            eq(friendships.requesterId, otherId),
            eq(friendships.addresseeId, userId),
          ),
        ),
      );
  });
};
const respondFriend: RouterServices["respondFriend"] = async (
  userId,
  requesterId,
  accept,
) => {
  return pairTransaction(userId, requesterId, async (tx) => {
    if (accept)
      await tx
        .update(friendships)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(
          and(
            eq(friendships.requesterId, requesterId),
            eq(friendships.addresseeId, userId),
          ),
        );
    else
      await tx
        .delete(friendships)
        .where(
          and(
            eq(friendships.requesterId, requesterId),
            eq(friendships.addresseeId, userId),
          ),
        );
  });
};
const blockUser: RouterServices["blockUser"] = async (userId, blockedId) => {
  return pairTransaction(userId, blockedId, async (tx) => {
    if (userId === blockedId) throw new Error("You cannot block yourself");
    await tx
      .delete(friendships)
      .where(
        or(
          and(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, blockedId),
          ),
          and(
            eq(friendships.requesterId, blockedId),
            eq(friendships.addresseeId, userId),
          ),
        ),
      );
    await tx
      .insert(userBlocks)
      .values({ blockerId: userId, blockedId })
      .onConflictDoNothing();
  });
};

const directPair = (first: string, second: string): [string, string] =>
  first < second ? [first, second] : [second, first];

const canDirectMessage = async (
  userId: string,
  otherId: string,
  client: Pick<typeof db, "select"> = db,
) => {
  if (userId === otherId) return false;
  if (!(await canInteractWithUser(userId, otherId, client))) return false;
  const active = await client
    .select({ id: users.id, messagePermission: users.messagePermission })
    .from(users)
    .where(
      and(
        inArray(users.id, [userId, otherId]),
        eq(users.accountStatus, "active"),
        isNull(users.deletedAt),
      ),
    );
  if (
    active.length !== 2 ||
    active.find((user) => user.id === otherId)?.messagePermission === "nobody"
  )
    return false;
  const [friendship] = await client
    .select({ status: friendships.status })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(
          and(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, otherId),
          ),
          and(
            eq(friendships.requesterId, otherId),
            eq(friendships.addresseeId, userId),
          ),
        ),
      ),
    )
    .limit(1);
  return Boolean(friendship);
};

const getConversationForPair = async (userAId: string, userBId: string) => {
  const [conversation] = await db
    .select()
    .from(directConversations)
    .where(
      and(
        eq(directConversations.userAId, userAId),
        eq(directConversations.userBId, userBId),
      ),
    )
    .limit(1);
  return conversation ?? null;
};

const ensureConversation = async (userId: string, otherId: string) => {
  const [userAId, userBId] = directPair(userId, otherId);
  return db.transaction(async (tx) => {
    let [conversation] = await tx
      .select()
      .from(directConversations)
      .where(
        and(
          eq(directConversations.userAId, userAId),
          eq(directConversations.userBId, userBId),
        ),
      )
      .limit(1);
    if (!conversation) {
      await tx
        .insert(directConversations)
        .values({ userAId, userBId })
        .onConflictDoNothing();
      [conversation] = await tx
        .select()
        .from(directConversations)
        .where(
          and(
            eq(directConversations.userAId, userAId),
            eq(directConversations.userBId, userBId),
          ),
        )
        .limit(1);
    }
    if (!conversation) throw new Error("Unable to create conversation");
    await tx
      .insert(directConversationMembers)
      .values([
        { conversationId: conversation.id, userId: userAId },
        { conversationId: conversation.id, userId: userBId },
      ])
      .onConflictDoNothing();
    return conversation;
  });
};

const toSocialUser = (
  row: {
    id: string;
    name: string | null;
    handle: string | null;
    image: string | null;
  },
  lastSeenAt?: Date | null,
): SocialUser => ({
  ...row,
  relationship: "friend",
  isOnline: isOnline(lastSeenAt ?? undefined),
  lastSeenAt: lastSeenAt ?? null,
});

const listDirectConversations: RouterServices["listDirectConversations"] =
  async (userId) => {
    const rows = await db
      .select({
        conversationId: directConversations.id,
        userAId: directConversations.userAId,
        userBId: directConversations.userBId,
        updatedAt: directConversations.updatedAt,
        lastReadAt: directConversationMembers.lastReadAt,
      })
      .from(directConversationMembers)
      .innerJoin(
        directConversations,
        eq(directConversationMembers.conversationId, directConversations.id),
      )
      .where(eq(directConversationMembers.userId, userId))
      .orderBy(desc(directConversations.updatedAt));
    if (!rows.length) return [];

    const otherIds = rows.map((row) =>
      row.userAId === userId ? row.userBId : row.userAId,
    );
    const usersById = new Map(
      (
        await db
          .select({
            id: users.id,
            name: users.name,
            handle: users.handle,
            image: users.image,
            avatarPreset: users.avatarPreset,
          })
          .from(users)
          .where(
            and(
              inArray(users.id, otherIds),
              eq(users.accountStatus, "active"),
              isNull(users.deletedAt),
            ),
          )
      ).map((row) => [row.id, row]),
    );
    const [presence, relationships, latestMessages] = await Promise.all([
      getPresenceMap(otherIds),
      getRelationshipMap(userId, otherIds),
      db
        .selectDistinctOn([directMessages.conversationId], {
          id: directMessages.id,
          conversationId: directMessages.conversationId,
          senderId: directMessages.senderId,
          senderName: users.name,
          body: directMessages.body,
          createdAt: directMessages.createdAt,
        })
        .from(directMessages)
        .innerJoin(users, eq(directMessages.senderId, users.id))
        .where(
          and(
            inArray(
              directMessages.conversationId,
              rows.map((row) => row.conversationId),
            ),
            isNull(directMessages.deletedAt),
          ),
        )
        .orderBy(directMessages.conversationId, desc(directMessages.id)),
    ]);
    const latestByConversation = new Map(
      latestMessages.map((message) => [message.conversationId, message]),
    );
    const result: DirectConversationSummary[] = [];
    for (const row of rows) {
      const otherId = row.userAId === userId ? row.userBId : row.userAId;
      const other = usersById.get(otherId);
      if (!other || relationships.get(otherId) !== "friend") continue;
      const last = latestByConversation.get(row.conversationId);
      result.push({
        id: row.conversationId,
        otherUser: toSocialUser(other, presence.get(otherId)),
        lastMessage: last ?? null,
        unread: Boolean(
          last &&
          last.senderId !== userId &&
          (!row.lastReadAt || last.createdAt > row.lastReadAt),
        ),
        updatedAt: row.updatedAt,
      });
    }
    return result;
  };

const getDirectThread: RouterServices["getDirectThread"] = async (
  userId,
  otherUserId,
  limit,
  before,
) => {
  const [other] = await db
    .select({
      id: users.id,
      name: users.name,
      handle: users.handle,
      image: users.image,
      avatarPreset: users.avatarPreset,
    })
    .from(users)
    .where(eq(users.id, otherUserId))
    .limit(1);
  if (!other || !(await canDirectMessage(userId, otherUserId)))
    return { conversationId: null, otherUser: null, messages: [] };
  const presence = await getPresenceMap([otherUserId]);
  const [userAId, userBId] = directPair(userId, otherUserId);
  const conversation = await getConversationForPair(userAId, userBId);
  if (!conversation)
    return {
      conversationId: null,
      otherUser: toSocialUser(other, presence.get(otherUserId)),
      messages: [],
    };
  const conditions = [
    eq(directMessages.conversationId, conversation.id),
    isNull(directMessages.deletedAt),
  ];
  if (before) conditions.push(lt(directMessages.id, before));
  const messages = await db
    .select({
      id: directMessages.id,
      conversationId: directMessages.conversationId,
      senderId: directMessages.senderId,
      senderName: users.name,
      body: directMessages.body,
      createdAt: directMessages.createdAt,
    })
    .from(directMessages)
    .innerJoin(users, eq(directMessages.senderId, users.id))
    .where(and(...conditions))
    .orderBy(desc(directMessages.createdAt), desc(directMessages.id))
    .limit(limit);
  return {
    conversationId: conversation.id,
    otherUser: toSocialUser(other, presence.get(otherUserId)),
    messages: messages.reverse(),
  };
};

const sendDirectMessage: RouterServices["sendDirectMessage"] = async (
  userId,
  recipientId,
  body,
  commandId,
) => {
  if (!(await canDirectMessage(userId, recipientId)))
    throw new Error(
      "Direct messages are available between friends who are not blocked.",
    );
  const conversation = await ensureConversation(userId, recipientId);
  const [message] = await pairTransaction(userId, recipientId, async (tx) => {
    if (!(await canDirectMessage(userId, recipientId, tx)))
      throw new Error("Messaging relationship changed.");
    if (commandId) {
      const [existing] = await tx
        .select()
        .from(directMessages)
        .where(
          and(
            eq(directMessages.senderId, userId),
            eq(directMessages.commandId, commandId),
          ),
        );
      if (existing) {
        if (
          existing.conversationId !== conversation.id ||
          existing.body !== body.trim()
        )
          throw new Error("Command ID reused for different message.");
        return [existing];
      }
    }
    const inserted = await tx
      .insert(directMessages)
      .values({
        conversationId: conversation.id,
        senderId: userId,
        body: body.trim(),
        commandId,
      })
      .returning({
        id: directMessages.id,
        conversationId: directMessages.conversationId,
        senderId: directMessages.senderId,
        body: directMessages.body,
        createdAt: directMessages.createdAt,
      });
    await tx
      .update(directConversations)
      .set({ updatedAt: sql`now()` })
      .where(eq(directConversations.id, conversation.id));
    if (inserted[0]) {
      await emitAccountNotification(tx, {
        userId: recipientId,
        actorId: userId,
        category: "message",
      });
      for (const notifyUserId of [userId, recipientId]) {
        const payload = JSON.stringify({
          userId: notifyUserId,
          messageId: inserted[0].id,
          conversationId: conversation.id,
        });
        await tx.execute(
          sql`select pg_notify('mafia_direct_messages', ${payload})`,
        );
      }
    }
    return inserted;
  });
  if (!message) throw new Error("Unable to send message");
  const [sender] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const result = {
    ...message,
    senderName: sender?.name ?? null,
  } satisfies DirectMessage;
  return result;
};

const markDirectConversationRead: RouterServices["markDirectConversationRead"] =
  async (userId, conversationId) => {
    await db
      .update(directConversationMembers)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(directConversationMembers.conversationId, conversationId),
          eq(directConversationMembers.userId, userId),
        ),
      );
  };

const setUserRoles: RouterServices["setUserRoles"] = async (
  actorId,
  userId,
  roles,
) => {
  await db.transaction(async (tx) => {
    await tx.delete(userRoles).where(eq(userRoles.userId, userId));
    await tx.insert(userRoles).values(roles.map((role) => ({ userId, role })));
    await tx
      .update(users)
      .set({ isAdmin: roles.includes("administrator") })
      .where(eq(users.id, userId));
    await tx.insert(auditLogs).values({
      actorId,
      subjectId: userId,
      action: "roles.updated",
      metadata: JSON.stringify({ roles }),
    });
  });
};

/**
 * Persists a completed match and its participants to the database.
 * Returns the ID of the newly created match.
 *
 * @param input - Match data to persist
 * @returns>} Match ID of the persisted match
 * @throws If failed to insert match
 */
const persistMatch = async (
  input: PersistMatchInput,
): Promise<{ id: number }> => {
  const gameId = input.gameId ?? `${input.roomName}:${input.startedAt}`;
  return db.transaction(async (tx) => {
    const ids = [
      ...new Set(
        input.participants.flatMap((p) => (p.userId ? [p.userId] : [])),
      ),
    ].sort();
    const accounts = ids.length
      ? await tx
          .select({
            id: users.id,
            deletedAt: users.deletedAt,
            name: users.name,
            handle: users.handle,
          })
          .from(users)
          .where(inArray(users.id, ids))
          .orderBy(users.id)
          .for("update")
      : [];
    const erased = new Set(
      accounts.filter((user) => user.deletedAt).map((user) => user.id),
    );
    const aliases = new Set(
      input.participants
        .filter((p) => p.userId && erased.has(p.userId))
        .map((p) => p.username),
    );
    const participants = input.participants.map((p) =>
      p.userId && erased.has(p.userId)
        ? { ...p, userId: null, username: "Deleted player" }
        : p,
    );
    const conversationHistory = anonymizeHistory(
      input.conversationHistory,
      aliases,
    );
    const actionHistory = anonymizeHistory(input.actionHistory, aliases);
    const [inserted] = await tx
      .insert(matches)
      .values({
        gameId,
        roomName: input.roomName,
        startedAt: new Date(input.startedAt),
        endedAt: new Date(input.endedAt),
        winningFaction: input.winningFaction,
        winningRoles: JSON.stringify(input.winningRoles),
        playerCount: input.participants.length,
        conversationHistory: JSON.stringify(conversationHistory),
        actionHistory: JSON.stringify(actionHistory),
      })
      .onConflictDoNothing({ target: matches.gameId })
      .returning({ id: matches.id });
    if (!inserted) {
      const [existing] = await tx
        .select({ id: matches.id })
        .from(matches)
        .where(eq(matches.gameId, gameId));
      if (!existing) throw new Error("Match persistence conflict");
      return existing;
    }
    if (input.participants.length)
      await tx.insert(matchParticipants).values(
        participants.map((p) => ({
          matchId: inserted.id,
          userId: p.userId ?? null,
          username: p.username,
          role: p.role,
          won: p.won,
        })),
      );
    return inserted;
  });
};

/**
 * Returns the active PartyServer room ID, creating it if this is the first lobby request.
 * This is matchmaking state only; live game state remains inside PartyServer.
 *
 * @returns The current room ID clients should connect to
 */
const getCurrentRoom = async (): Promise<{ roomId: string }> => {
  // Browser tests can exercise the real lobby and PartyServer transport without
  // requiring a local PostgreSQL installation. Persistence is intentionally
  // bypassed only for the explicitly opt-in Playwright server process.
  if (process.env.PLAYWRIGHT_NO_DB === "true") {
    return { roomId: "playwright-current-room" };
  }

  const existingRows = await db
    .select({ roomId: activeRoom.roomId })
    .from(activeRoom)
    .where(eq(activeRoom.id, 1))
    .limit(1);

  const existing = existingRows[0];
  if (existing) {
    return { roomId: existing.roomId };
  }

  const roomId = crypto.randomUUID();
  await db.insert(activeRoom).values({ id: 1, roomId }).onConflictDoNothing();

  const rows = await db
    .select({ roomId: activeRoom.roomId })
    .from(activeRoom)
    .where(eq(activeRoom.id, 1))
    .limit(1);

  return { roomId: rows[0]?.roomId ?? roomId };
};

/**
 * Rotates the active game room ID.
 * Generates a new random UUID and updates the singleton active room record.
 *
 * @returns>} The new active room ID
 */
const rotateActiveRoom = async (): Promise<{ roomId: string }> => {
  const roomId = crypto.randomUUID();
  await db
    .insert(activeRoom)
    .values({ id: 1, roomId })
    .onConflictDoUpdate({
      target: activeRoom.id,
      set: { roomId, updatedAt: sql`now()` },
    });
  return { roomId };
};

export const trpcServices: RouterServices = {
  parties: partyServices,
  analysis: matchAnalysisServices,
  features: accountFeatureServices,
  getRecentMatches,
  searchUsers: accountServices.searchUsers,
  setUserAdmin: accountServices.setUserAdmin,
  getProfile: accountServices.getProfile,
  updateProfile: accountServices.updateProfile,
  getStats: accountServices.getStats,
  listDeviceSessions,
  revokeDeviceSession,
  searchCommunity,
  listFriends,
  requestFriend,
  respondFriend,
  removeFriend,
  blockUser,
  listDirectConversations,
  getDirectThread,
  sendDirectMessage,
  markDirectConversationRead,
  markPresence,
  setUserRoles,
  persistMatch,
  getCurrentRoom,
  rotateActiveRoom,
};
