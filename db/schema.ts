import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTableCreator,
  primaryKey,
  serial,
  text,
  timestamp,
  boolean,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Multi-project schema prefix for shared Postgres instance.
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `nextjs_${name}`);

/** Blog posts table (legacy, may be deprecated). */
export const posts = createTable(
  "post",
  () => ({
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 256 }),
    createdById: varchar("created_by_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  }),
  (t) => [
    index("created_by_idx").on(t.createdById),
    index("name_idx").on(t.name),
  ],
);

export const users = createTable("user", () => ({
  id: varchar("id", { length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }).default(
    sql`now()`,
  ),
  image: varchar("image", { length: 255 }),
  handle: varchar("handle", { length: 32 }).unique(),
  passwordHash: text("password_hash"),
  authVersion: integer("auth_version").notNull().default(0),
  messagePermission: varchar("message_permission", { length: 16 })
    .notNull()
    .default("friends"),
  invitePermission: varchar("invite_permission", { length: 16 })
    .notNull()
    .default("friends"),
  hidePresence: boolean("hide_presence").notNull().default(false),
  avatarPreset: varchar("avatar_preset", { length: 24 }),
  notificationFriendRequests: boolean("notification_friend_requests")
    .notNull()
    .default(true),
  notificationMessages: boolean("notification_messages")
    .notNull()
    .default(true),
  notificationInvites: boolean("notification_invites").notNull().default(true),
  bio: varchar("bio", { length: 280 }),
  profileVisibility: varchar("profile_visibility", { length: 16 })
    .notNull()
    .default("public"),
  historyVisibility: varchar("history_visibility", { length: 16 })
    .notNull()
    .default("public"),
  theme: varchar("theme", { length: 16 }).notNull().default("dark"),
  reducedMotion: boolean("reduced_motion").notNull().default(false),
  soundEnabled: boolean("sound_enabled").notNull().default(true),
  notificationsEnabled: boolean("notifications_enabled")
    .notNull()
    .default(true),
  accountStatus: varchar("account_status", { length: 24 })
    .notNull()
    .default("active"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  isAdmin: boolean("is_admin").notNull().default(false),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
}));

export const accounts = createTable(
  "account",
  () => ({
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", {
      length: 255,
    }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  () => ({
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const matches = createTable(
  "match",
  () => ({
    id: serial("id").primaryKey(),
    gameId: varchar("game_id", { length: 128 }).unique(),
    roomName: varchar("room_name", { length: 255 }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
    winningFaction: varchar("winning_faction", { length: 255 }).notNull(),
    winningRoles: text("winning_roles").notNull(),
    playerCount: integer("player_count").notNull(),
    conversationHistory: text("conversation_history").notNull(),
    actionHistory: text("action_history").notNull(),
  }),
  (t) => [index("match_ended_at_idx").on(t.endedAt)],
);

export const activeRoom = createTable("active_room", () => ({
  id: integer("id").primaryKey(),
  roomId: varchar("room_id", { length: 36 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}));

export const customLobbies = createTable(
  "custom_lobby",
  () => ({
    roomId: varchar("room_id", { length: 64 }).primaryKey(),
    ownerId: varchar("owner_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    config: text("config").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  }),
  (t) => [index("custom_lobby_owner_idx").on(t.ownerId)],
);

export const matchParticipants = createTable(
  "match_participant",
  () => ({
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    username: varchar("username", { length: 255 }).notNull(),
    role: varchar("role", { length: 255 }).notNull(),
    won: boolean("won").notNull().default(false),
  }),
  (t) => [
    index("match_participant_match_idx").on(t.matchId),
    index("match_participant_user_idx").on(t.userId),
    index("match_participant_username_idx").on(t.username),
  ],
);

export const userRoles = createTable(
  "user_role",
  () => ({
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 32 }).notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  }),
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);

export const friendships = createTable(
  "friendship",
  () => ({
    requesterId: varchar("requester_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: varchar("addressee_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  }),
  (t) => [
    primaryKey({ columns: [t.requesterId, t.addresseeId] }),
    index("friendship_addressee_idx").on(t.addresseeId),
  ],
);

/** Persistent one-to-one conversations outside game rooms. */
export const directConversations = createTable(
  "direct_conversation",
  () => ({
    id: serial("id").primaryKey(),
    userAId: varchar("user_a_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userBId: varchar("user_b_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  }),
  (t) => [
    uniqueIndex("direct_conversation_pair_idx").on(t.userAId, t.userBId),
    index("direct_conversation_user_a_idx").on(t.userAId),
    index("direct_conversation_user_b_idx").on(t.userBId),
  ],
);

export const directConversationMembers = createTable(
  "direct_conversation_member",
  () => ({
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => directConversations.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  }),
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index("direct_conversation_member_user_idx").on(t.userId),
  ],
);

export const directMessages = createTable(
  "direct_message",
  () => ({
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => directConversations.id, { onDelete: "cascade" }),
    senderId: varchar("sender_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    commandId: varchar("command_id", { length: 128 }),
    body: varchar("body", { length: 2000 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  }),
  (t) => [
    index("direct_message_conversation_idx").on(t.conversationId, t.createdAt),
    index("direct_message_sender_idx").on(t.senderId),
    uniqueIndex("direct_message_command_idx").on(t.senderId, t.commandId),
  ],
);

export const userPresence = createTable(
  "user_presence",
  () => ({
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  }),
  (t) => [index("user_presence_last_seen_idx").on(t.lastSeenAt)],
);

export const userBlocks = createTable(
  "user_block",
  () => ({
    blockerId: varchar("blocker_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: varchar("blocked_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  }),
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })],
);

export const auditLogs = createTable(
  "audit_log",
  () => ({
    id: serial("id").primaryKey(),
    actorId: varchar("actor_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    subjectId: varchar("subject_id", { length: 255 }).references(
      () => users.id,
      {
        onDelete: "set null",
      },
    ),
    action: varchar("action", { length: 64 }).notNull(),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  }),
  (t) => [index("audit_log_subject_idx").on(t.subjectId)],
);

export const mobileSessions = createTable(
  "mobile_session",
  () => ({
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshHash: varchar("refresh_hash", { length: 64 }).notNull().unique(),
    authVersion: integer("auth_version").notNull(),
    deviceName: varchar("device_name", { length: 80 })
      .notNull()
      .default("Mobile device"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  }),
  (t) => [index("mobile_session_user_idx").on(t.userId)],
);
export const requestLimits = createTable("request_limit", () => ({
  key: varchar("key", { length: 64 }).primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  hits: integer("hits").notNull(),
}));

export const notifications = createTable(
  "notification",
  () => ({
    id: serial("id").primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: varchar("actor_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    category: varchar("category", { length: 24 }).notNull(),
    roomId: varchar("room_id", { length: 64 }),
    invitationId: integer("invitation_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  }),
  (t) => [index("notification_user_created_idx").on(t.userId, t.createdAt)],
);
export const lobbyInvitations = createTable(
  "lobby_invitation",
  () => ({
    id: serial("id").primaryKey(),
    senderId: varchar("sender_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: varchar("recipient_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roomId: varchar("room_id", { length: 64 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  }),
  (t) => [index("invitation_recipient_idx").on(t.recipientId)],
);
export const lobbyPresets = createTable(
  "lobby_preset",
  () => ({
    id: serial("id").primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 60 }).notNull(),
    config: text("config").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  }),
  (t) => [index("preset_user_idx").on(t.userId)],
);
export const playerReports = createTable(
  "player_report",
  () => ({
    id: serial("id").primaryKey(),
    reporterId: varchar("reporter_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    subjectId: varchar("subject_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    reason: varchar("reason", { length: 32 }).notNull(),
    details: text("details").notNull(),
    matchId: integer("match_id").references(() => matches.id, {
      onDelete: "set null",
    }),
    messageId: integer("message_id").references(() => directMessages.id, {
      onDelete: "set null",
    }),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    resolution: text("resolution"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  }),
  (t) => [
    index("report_reporter_idx").on(t.reporterId),
    index("report_status_idx").on(t.status),
  ],
);
export const mobileOauthRequests = createTable("mobile_oauth_request", () => ({
  id: varchar("id", { length: 128 }).primaryKey(),
  challenge: varchar("challenge", { length: 128 }).notNull(),
  browserHash: varchar("browser_hash", { length: 64 }),
  codeHash: varchar("code_hash", { length: 64 }),
  userId: varchar("user_id", { length: 255 }).references(() => users.id, {
    onDelete: "cascade",
  }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}));

/** Persistent social groups; destination is a suggestion, never a game join. */
export const parties = createTable("party", () => ({
  id: varchar("id", { length: 36 }).primaryKey(),
  leaderId: varchar("leader_id", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  roomId: varchar("room_id", { length: 64 }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}));
export const partyMembers = createTable(
  "party_member",
  () => ({
    partyId: varchar("party_id", { length: 36 })
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  }),
  (t) => [index("party_member_party_idx").on(t.partyId)],
);
export const partyInvitations = createTable(
  "party_invitation",
  () => ({
    id: serial("id").primaryKey(),
    partyId: varchar("party_id", { length: 36 })
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    senderId: varchar("sender_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: varchar("recipient_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  }),
  (t) => [index("party_invitation_recipient_idx").on(t.recipientId)],
);

// helper object for easier schema imports
export const schema = {
  createTable,
  parties,
  partyMembers,
  partyInvitations,
  notifications,
  lobbyInvitations,
  lobbyPresets,
  playerReports,
  mobileOauthRequests,
  mobileSessions,
  requestLimits,
  posts,
  users,
  usersRelations,
  accounts,
  accountsRelations,
  verificationTokens,
  matches,
  activeRoom,
  customLobbies,
  matchParticipants,
  userRoles,
  friendships,
  directConversations,
  directConversationMembers,
  directMessages,
  userPresence,
  userBlocks,
  auditLogs,
};
