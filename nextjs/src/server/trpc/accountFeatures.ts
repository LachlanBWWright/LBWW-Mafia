import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { env } from "~/env";
import {
  accounts,
  auditLogs,
  customLobbies,
  directConversationMembers,
  directConversations,
  directMessages,
  friendships,
  lobbyInvitations,
  lobbyPresets,
  matchParticipants,
  matches,
  mobileOauthRequests,
  mobileSessions,
  notifications,
  playerReports,
  userBlocks,
  userPresence,
  userRoles,
  users,
} from "@mernmafia/db/schema";
import {
  type AccountFeatureServices,
  type FeaturePreferences,
  type AccountNotification,
} from "@mernmafia/shared/trpc/accountFeatures";
import { lobbyConfigSchema } from "@mernmafia/shared/game/lobbyConfig";
import { anonymizeHistory } from "@mernmafia/shared/game/accountAnonymization";
import { deserializeEventHistory } from "@mernmafia/shared/trpc/validators";
import { canInteractWithUser } from "./services/presence";
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const forbidden = (message = "This action is unavailable.") =>
  new TRPCError({ code: "FORBIDDEN", message });
async function lockUsers(tx: Transaction, ids: string[]) {
  const uniqueIds = [...new Set(ids)].sort();
  const rows = await tx
    .select({
      id: users.id,
      accountStatus: users.accountStatus,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(inArray(users.id, uniqueIds))
    .orderBy(users.id)
    .for("update");
  if (
    rows.length !== uniqueIds.length ||
    rows.some((row) => row.accountStatus !== "active" || row.deletedAt)
  )
    throw forbidden();
}
export async function emitAccountNotification(
  tx: Transaction,
  input: {
    userId: string;
    actorId: string;
    category: AccountNotification["category"];
    roomId?: string;
    invitationId?: number;
  },
) {
  const [recipient] = await tx
    .select()
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (
    recipient?.accountStatus !== "active" ||
    recipient.deletedAt ||
    !recipient.notificationsEnabled
  )
    return;
  const enabled =
    input.category === "message"
      ? recipient.notificationMessages
      : input.category === "friend_request"
        ? recipient.notificationFriendRequests
        : recipient.notificationInvites;
  if (!enabled) return;
  await tx.insert(notifications).values(input);
}
const prefs = (row: typeof users.$inferSelect): FeaturePreferences => ({
  messagePermission: row.messagePermission === "nobody" ? "nobody" : "friends",
  invitePermission: row.invitePermission === "nobody" ? "nobody" : "friends",
  hidePresence: row.hidePresence,
  avatarPreset: ([
    "detective",
    "mafia",
    "doctor",
    "moon",
    "fox",
    "owl",
  ].includes(row.avatarPreset ?? "")
    ? row.avatarPreset
    : null) as FeaturePreferences["avatarPreset"],
  notificationFriendRequests: row.notificationFriendRequests,
  notificationMessages: row.notificationMessages,
  notificationInvites: row.notificationInvites,
});
async function preferences(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.accountStatus, "active"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  if (!user) throw forbidden();
  return prefs(user);
}
async function checkInvite(
  tx: Transaction,
  senderId: string,
  recipientId: string,
  roomId: string,
) {
  if (
    senderId === recipientId ||
    !(await canInteractWithUser(senderId, recipientId, tx))
  )
    throw forbidden();
  const pair = await tx
    .select()
    .from(users)
    .where(inArray(users.id, [senderId, recipientId]));
  if (
    pair.length !== 2 ||
    pair.some((u) => u.accountStatus !== "active" || u.deletedAt) ||
    pair.find((u) => u.id === recipientId)?.invitePermission === "nobody"
  )
    throw forbidden();
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
    )
    .limit(1);
  const [lobby] = await tx
    .select()
    .from(customLobbies)
    .where(
      and(
        eq(customLobbies.roomId, roomId),
        eq(customLobbies.ownerId, senderId),
      ),
    )
    .limit(1);
  if (!friend || !lobby)
    throw forbidden("Only friends can be invited to a lobby you host.");
}
function invitation(
  row: typeof lobbyInvitations.$inferSelect,
  senderName: string | null,
) {
  return {
    ...row,
    status:
      row.status === "pending" && row.expiresAt <= new Date()
        ? "expired"
        : row.status,
    senderName,
  };
}
export const accountFeatureServices: AccountFeatureServices = {
  async inbox(userId) {
    const rows = await db
      .select({ item: notifications, actorName: users.name })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.actorId))
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(100);
    return rows.map(({ item, actorName }) => ({
      ...item,
      category: item.category as AccountNotification["category"],
      actorName,
    }));
  },
  async markRead(userId, id) {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
          id ? eq(notifications.id, id) : undefined,
        ),
      );
  },
  preferences,
  async updatePreferences(userId, input) {
    await db.transaction(async (tx) => {
      await lockUsers(tx, [userId]);
      await tx
        .update(users)
        .set(input)
        .where(
          and(
            eq(users.id, userId),
            eq(users.accountStatus, "active"),
            isNull(users.deletedAt),
          ),
        );
      if (input.hidePresence)
        await tx.delete(userPresence).where(eq(userPresence.userId, userId));
    });
    return preferences(userId);
  },
  async hostedLobbies(userId) {
    return db
      .select({
        roomId: customLobbies.roomId,
        createdAt: customLobbies.createdAt,
      })
      .from(customLobbies)
      .where(eq(customLobbies.ownerId, userId))
      .orderBy(desc(customLobbies.createdAt));
  },
  async invitations(userId) {
    const rows = await db
      .select({ item: lobbyInvitations, senderName: users.name })
      .from(lobbyInvitations)
      .innerJoin(users, eq(users.id, lobbyInvitations.senderId))
      .where(eq(lobbyInvitations.recipientId, userId))
      .orderBy(desc(lobbyInvitations.createdAt))
      .limit(100);
    return rows.map(({ item, senderName }) => invitation(item, senderName));
  },
  async invite(userId, input) {
    return db.transaction(async (tx) => {
      await lockUsers(tx, [userId, input.recipientId]);
      await checkInvite(tx, userId, input.recipientId, input.roomId);
      const [existing] = await tx
        .select()
        .from(lobbyInvitations)
        .where(
          and(
            eq(lobbyInvitations.senderId, userId),
            eq(lobbyInvitations.recipientId, input.recipientId),
            eq(lobbyInvitations.roomId, input.roomId),
            eq(lobbyInvitations.status, "pending"),
            gt(lobbyInvitations.expiresAt, new Date()),
          ),
        )
        .limit(1);
      const [sender] = await tx
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId));
      if (existing) return invitation(existing, sender?.name ?? null);
      const [created] = await tx
        .insert(lobbyInvitations)
        .values({
          senderId: userId,
          recipientId: input.recipientId,
          roomId: input.roomId,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        })
        .returning();
      if (!created) throw new Error("Invitation creation failed");
      await emitAccountNotification(tx, {
        userId: input.recipientId,
        actorId: userId,
        category: "lobby_invite",
        roomId: input.roomId,
        invitationId: created.id,
      });
      return invitation(created, sender?.name ?? null);
    });
  },
  async respondInvitation(userId, input) {
    return db.transaction(async (tx) => {
      const [candidate] = await tx
        .select()
        .from(lobbyInvitations)
        .where(
          and(
            eq(lobbyInvitations.id, input.id),
            eq(lobbyInvitations.recipientId, userId),
          ),
        )
        .limit(1);
      if (!candidate) throw forbidden();
      await lockUsers(tx, [userId, candidate.senderId]);
      const [current] = await tx
        .select()
        .from(lobbyInvitations)
        .where(eq(lobbyInvitations.id, input.id))
        .for("update");
      if (current?.status !== "pending" || current.expiresAt <= new Date())
        throw forbidden("This invitation is no longer available.");
      if (input.accept)
        await checkInvite(tx, candidate.senderId, userId, candidate.roomId);
      await tx
        .update(lobbyInvitations)
        .set({ status: input.accept ? "accepted" : "declined" })
        .where(eq(lobbyInvitations.id, input.id));
      await tx
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.invitationId, input.id),
          ),
        );
      return { roomId: input.accept ? candidate.roomId : null };
    });
  },
  async presets(userId) {
    return (
      await db
        .select()
        .from(lobbyPresets)
        .where(eq(lobbyPresets.userId, userId))
        .orderBy(desc(lobbyPresets.updatedAt))
    ).map((row) => ({
      id: row.id,
      name: row.name,
      config: lobbyConfigSchema.parse(JSON.parse(row.config)),
      updatedAt: row.updatedAt,
    }));
  },
  async savePreset(userId, input) {
    return db.transaction(async (tx) => {
      await lockUsers(tx, [userId]);
      const config = lobbyConfigSchema.parse(input.config);
      const values = {
        name: input.name,
        config: JSON.stringify(config),
        updatedAt: new Date(),
      };
      if (!input.id) {
        const count = await tx
          .select({ id: lobbyPresets.id })
          .from(lobbyPresets)
          .where(eq(lobbyPresets.userId, userId));
        if (count.length >= 20)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You can save up to 20 lobby presets.",
          });
      }
      const [row] = input.id
        ? await tx
            .update(lobbyPresets)
            .set(values)
            .where(
              and(
                eq(lobbyPresets.id, input.id),
                eq(lobbyPresets.userId, userId),
              ),
            )
            .returning()
        : await tx
            .insert(lobbyPresets)
            .values({ ...values, userId })
            .returning();
      if (!row) throw forbidden();
      return { id: row.id, name: row.name, config, updatedAt: row.updatedAt };
    });
  },
  async deletePreset(userId, id) {
    await db
      .delete(lobbyPresets)
      .where(and(eq(lobbyPresets.id, id), eq(lobbyPresets.userId, userId)));
  },
  async blocked(userId) {
    return db
      .select({ id: users.id, name: users.name, handle: users.handle })
      .from(userBlocks)
      .innerJoin(users, eq(users.id, userBlocks.blockedId))
      .where(eq(userBlocks.blockerId, userId));
  },
  async unblock(userId, id) {
    await db.transaction(async (tx) => {
      await lockUsers(tx, [userId, id]);
      await tx
        .delete(userBlocks)
        .where(
          and(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, id)),
        );
    });
  },
  async achievements(userId) {
    const rows = await db
      .select({ won: matchParticipants.won, role: matchParticipants.role })
      .from(matchParticipants)
      .where(eq(matchParticipants.userId, userId));
    const wins = rows.filter((r) => r.won).length;
    const roles = new Set(rows.map((r) => r.role)).size;
    return [
      {
        id: "first-game",
        name: "First case",
        description: "Complete your first game.",
        progress: Math.min(rows.length, 1),
        target: 1,
        unlocked: rows.length > 0,
      },
      {
        id: "first-win",
        name: "First victory",
        description: "Win your first game.",
        progress: Math.min(wins, 1),
        target: 1,
        unlocked: wins > 0,
      },
      {
        id: "ten-wins",
        name: "Seasoned player",
        description: "Win ten games.",
        progress: Math.min(wins, 10),
        target: 10,
        unlocked: wins >= 10,
      },
      {
        id: "five-roles",
        name: "Many disguises",
        description: "Complete games as five different roles.",
        progress: Math.min(roles, 5),
        target: 5,
        unlocked: roles >= 5,
      },
      {
        id: "fifty-games",
        name: "Regular",
        description: "Complete fifty games.",
        progress: Math.min(rows.length, 50),
        target: 50,
        unlocked: rows.length >= 50,
      },
    ];
  },
  async report(userId, input) {
    return db.transaction(async (tx) => {
      await lockUsers(tx, [userId, input.subjectId]);
      if (input.subjectId === userId)
        throw forbidden("You cannot report yourself.");
      const [subject] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, input.subjectId), isNull(users.deletedAt)));
      if (!subject) throw forbidden();
      if (input.matchId) {
        const participants = await tx
          .select({ userId: matchParticipants.userId })
          .from(matchParticipants)
          .where(eq(matchParticipants.matchId, input.matchId));
        if (
          !participants.some((p) => p.userId === userId) ||
          !participants.some((p) => p.userId === input.subjectId)
        )
          throw forbidden(
            "You can only attach a match you played with this player.",
          );
      }
      if (input.messageId) {
        const [message] = await tx
          .select({
            senderId: directMessages.senderId,
            a: directConversations.userAId,
            b: directConversations.userBId,
          })
          .from(directMessages)
          .innerJoin(
            directConversations,
            eq(directConversations.id, directMessages.conversationId),
          )
          .where(eq(directMessages.id, input.messageId));
        if (
          message?.senderId !== input.subjectId ||
          ![message.a, message.b].includes(userId)
        )
          throw forbidden(
            "You can only attach a message this player sent to you.",
          );
      }
      const [row] = await tx
        .insert(playerReports)
        .values({ ...input, reporterId: userId })
        .returning({ id: playerReports.id });
      if (!row) throw new Error("Report creation failed");
      return row;
    });
  },
  async reports(userId, isAdmin) {
    return db
      .select()
      .from(playerReports)
      .where(isAdmin ? undefined : eq(playerReports.reporterId, userId))
      .orderBy(desc(playerReports.createdAt))
      .limit(100);
  },
  async reviewReport(userId, input) {
    await db.transaction(async (tx) => {
      const [admin] = await tx
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, userId),
            eq(users.accountStatus, "active"),
            isNull(users.deletedAt),
          ),
        );
      const [role] = await tx
        .select()
        .from(userRoles)
        .where(
          and(
            eq(userRoles.userId, userId),
            eq(userRoles.role, "administrator"),
          ),
        );
      if (!admin || (!admin.isAdmin && !role)) throw forbidden();
      const [row] = await tx
        .update(playerReports)
        .set({ status: input.status, resolution: input.resolution })
        .where(eq(playerReports.id, input.id))
        .returning({ subjectId: playerReports.subjectId });
      if (!row)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report not found.",
        });
      await tx.insert(auditLogs).values({
        actorId: userId,
        subjectId: row.subjectId,
        action: "report_review",
        metadata: JSON.stringify({
          reportId: input.id,
          status: input.status,
        }),
      });
    });
  },
  async exportData(userId) {
    return db.transaction(async (tx) => {
      const [profile] = await tx
        .select({
          id: users.id,
          email: users.email,
          theme: users.theme,
          reducedMotion: users.reducedMotion,
          soundEnabled: users.soundEnabled,
          notificationsEnabled: users.notificationsEnabled,
          name: users.name,
          handle: users.handle,
          bio: users.bio,
          image: users.image,
          profileVisibility: users.profileVisibility,
          historyVisibility: users.historyVisibility,
        })
        .from(users)
        .where(eq(users.id, userId));
      const memberships = await tx
        .select()
        .from(directConversationMembers)
        .where(eq(directConversationMembers.userId, userId));
      const ids = memberships.map((m) => m.conversationId);
      return {
        version: 1,
        exportedAt: new Date(),
        profile,
        preferences: await preferences(userId),
        friendships: await tx
          .select()
          .from(friendships)
          .where(
            or(
              eq(friendships.requesterId, userId),
              eq(friendships.addresseeId, userId),
            ),
          ),
        blocks: await tx
          .select()
          .from(userBlocks)
          .where(eq(userBlocks.blockerId, userId)),
        messages: ids.length
          ? await tx
              .select()
              .from(directMessages)
              .where(
                and(
                  inArray(directMessages.conversationId, ids),
                  eq(directMessages.senderId, userId),
                ),
              )
          : [],
        conversationMemberships: memberships,
        deviceSessions: await tx
          .select({
            id: mobileSessions.id,
            deviceName: mobileSessions.deviceName,
            createdAt: mobileSessions.createdAt,
            expiresAt: mobileSessions.expiresAt,
            revokedAt: mobileSessions.revokedAt,
          })
          .from(mobileSessions)
          .where(eq(mobileSessions.userId, userId)),
        linkedAccounts: await tx
          .select({
            provider: accounts.provider,
            providerAccountId: accounts.providerAccountId,
          })
          .from(accounts)
          .where(eq(accounts.userId, userId)),
        matchParticipation: await tx
          .select()
          .from(matchParticipants)
          .where(eq(matchParticipants.userId, userId)),
        presets: await tx
          .select()
          .from(lobbyPresets)
          .where(eq(lobbyPresets.userId, userId)),
        notifications: await tx
          .select()
          .from(notifications)
          .where(eq(notifications.userId, userId)),
        invitations: await tx
          .select()
          .from(lobbyInvitations)
          .where(
            or(
              eq(lobbyInvitations.senderId, userId),
              eq(lobbyInvitations.recipientId, userId),
            ),
          ),
        reports: await tx
          .select()
          .from(playerReports)
          .where(eq(playerReports.reporterId, userId)),
      };
    });
  },
  async deleteAccount(userId, confirmation) {
    if (confirmation !== "DELETE")
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Type DELETE to confirm.",
      });
    await db.transaction(async (tx) => {
      await lockUsers(tx, [userId]);
      const [user] = await tx.select().from(users).where(eq(users.id, userId));
      if (!user || user.deletedAt) throw forbidden();
      const hosted = await tx
        .select({ roomId: customLobbies.roomId })
        .from(customLobbies)
        .where(eq(customLobbies.ownerId, userId));
      try {
        await Promise.all(
          hosted.map(async (lobby) => {
            const response = await fetch(
              `${env.NEXT_PUBLIC_SOCKET_URL.replace(/\/$/, "")}/parties/main/${encodeURIComponent(lobby.roomId)}`,
              {
                method: "DELETE",
                headers: { authorization: `Bearer ${env.BACKEND_SECRET}` },
                signal: AbortSignal.timeout(5000),
              },
            );
            if (!response.ok) throw new Error("Lobby close failed");
          }),
        );
      } catch {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message:
            "Unable to close your lobbies. Try deleting your account again shortly.",
        });
      }
      const participation = await tx
        .select()
        .from(matchParticipants)
        .where(eq(matchParticipants.userId, userId))
        // Shared matches must be locked in a consistent order when several players delete accounts.
        .orderBy(matchParticipants.matchId);
      for (const participationRow of participation) {
        const [match] = await tx
          .select()
          .from(matches)
          .where(eq(matches.id, participationRow.matchId))
          .for("update");
        if (!match) continue;
        const aliases = new Set(
          [participationRow.username, user.name, user.handle].filter(
            (v): v is string => Boolean(v),
          ),
        );
        const scrub = (history: string) =>
          JSON.stringify(
            anonymizeHistory(deserializeEventHistory(history), aliases),
          );
        await tx
          .update(matches)
          .set({
            conversationHistory: scrub(match.conversationHistory),
            actionHistory: scrub(match.actionHistory),
          })
          .where(eq(matches.id, match.id));
      }
      await tx
        .update(matchParticipants)
        .set({ userId: null, username: "Deleted player" })
        .where(eq(matchParticipants.userId, userId));
      const conversations = await tx
        .select({ id: directConversations.id })
        .from(directConversations)
        .where(
          or(
            eq(directConversations.userAId, userId),
            eq(directConversations.userBId, userId),
          ),
        );
      if (conversations.length)
        await tx.delete(directConversations).where(
          inArray(
            directConversations.id,
            conversations.map((c) => c.id),
          ),
        );
      await tx.delete(accounts).where(eq(accounts.userId, userId));
      await tx.delete(mobileSessions).where(eq(mobileSessions.userId, userId));
      await tx
        .delete(mobileOauthRequests)
        .where(eq(mobileOauthRequests.userId, userId));
      await tx.delete(customLobbies).where(eq(customLobbies.ownerId, userId));
      await tx.delete(lobbyPresets).where(eq(lobbyPresets.userId, userId));
      await tx
        .delete(notifications)
        .where(
          or(
            eq(notifications.userId, userId),
            eq(notifications.actorId, userId),
          ),
        );
      await tx
        .delete(lobbyInvitations)
        .where(
          or(
            eq(lobbyInvitations.senderId, userId),
            eq(lobbyInvitations.recipientId, userId),
          ),
        );
      await tx
        .delete(friendships)
        .where(
          or(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, userId),
          ),
        );
      await tx
        .delete(userBlocks)
        .where(
          or(
            eq(userBlocks.blockerId, userId),
            eq(userBlocks.blockedId, userId),
          ),
        );
      await tx.delete(userPresence).where(eq(userPresence.userId, userId));
      await tx.delete(userRoles).where(eq(userRoles.userId, userId));
      await tx
        .update(playerReports)
        .set({ details: "[Removed after account deletion]" })
        .where(eq(playerReports.reporterId, userId));
      await tx
        .update(users)
        .set({
          name: "Deleted player",
          handle: null,
          email: `deleted-${crypto.randomUUID()}@invalid.local`,
          image: null,
          avatarPreset: null,
          bio: null,
          passwordHash: null,
          authVersion: sql`${users.authVersion}+1`,
          isAdmin: false,
          deletedAt: new Date(),
          accountStatus: "deleted",
          profileVisibility: "private",
          historyVisibility: "private",
          hidePresence: true,
          notificationsEnabled: false,
        })
        .where(eq(users.id, userId));
      await tx
        .insert(auditLogs)
        .values({ subjectId: userId, action: "self_delete_account" });
    });
  },
};
