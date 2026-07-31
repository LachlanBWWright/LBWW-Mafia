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
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: timestamp("email_verified", { withTimezone: true }).default(
    sql`now()`,
  ),
  image: varchar("image", { length: 255 }),
  handle: varchar("handle", { length: 32 }).unique(),
  passwordHash: text("password_hash"),
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
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
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

export const sessions = createTable(
  "session",
  () => ({
    sessionToken: varchar("session_token", { length: 255 })
      .notNull()
      .primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  }),
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
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
    subjectId: varchar("subject_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 64 }).notNull(),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  }),
  (t) => [index("audit_log_subject_idx").on(t.subjectId)],
);

// helper object for easier schema imports
export const schema = {
  createTable,
  posts,
  users,
  usersRelations,
  accounts,
  accountsRelations,
  sessions,
  sessionsRelations,
  verificationTokens,
  matches,
  activeRoom,
  matchParticipants,
  userRoles,
  friendships,
  userBlocks,
  auditLogs,
};
