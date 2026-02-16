/**
 * Shared Drizzle Schema
 * 
 * This schema is shared between the server and nextjs components.
 * Location: /db/schema.ts (root of repository)
 * 
 * Used by:
 * - nextjs: Web application authentication and user management
 * - server: Can import for shared data models (if needed)
 */

import { relations, sql } from "drizzle-orm";
import { index, primaryKey, sqliteTableCreator } from "drizzle-orm/sqlite-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = sqliteTableCreator((name) => `nextjs_${name}`);

export const posts = createTable(
  "post",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    name: d.text({ length: 256 }),
    createdById: d
      .text({ length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: d
      .integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("created_by_idx").on(t.createdById),
    index("name_idx").on(t.name),
  ],
);

export const users = createTable("user", (d) => ({
  id: d
    .text({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.text({ length: 255 }),
  email: d.text({ length: 255 }).notNull(),
  emailVerified: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
  image: d.text({ length: 255 }),
  isAdmin: d.integer({ mode: "boolean" }).notNull().default(false),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d.text({ length: 255 }).notNull(),
    provider: d.text({ length: 255 }).notNull(),
    providerAccountId: d.text({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.text({ length: 255 }),
    scope: d.text({ length: 255 }),
    id_token: d.text(),
    session_state: d.text({ length: 255 }),
  }),
  (t) => [
    primaryKey({
      columns: [t.provider, t.providerAccountId],
    }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.text({ length: 255 }).notNull().primaryKey(),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => users.id),
    expires: d.integer({ mode: "timestamp" }).notNull(),
  }),
  (t) => [index("session_userId_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.text({ length: 255 }).notNull(),
    token: d.text({ length: 255 }).notNull(),
    expires: d.integer({ mode: "timestamp" }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const matches = createTable(
  "match",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    roomName: d.text({ length: 255 }).notNull(),
    startedAt: d.integer({ mode: "timestamp" }).notNull(),
    endedAt: d.integer({ mode: "timestamp" }).notNull(),
    winningFaction: d.text({ length: 255 }).notNull(),
    winningRoles: d.text().notNull(),
    playerCount: d.integer({ mode: "number" }).notNull(),
    conversationHistory: d.text().notNull(),
    actionHistory: d.text().notNull(),
  }),
  (t) => [index("match_endedAt_idx").on(t.endedAt)],
);

export const matchParticipants = createTable(
  "match_participant",
  (d) => ({
    id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    matchId: d
      .integer({ mode: "number" })
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: d.text({ length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    username: d.text({ length: 255 }).notNull(),
    role: d.text({ length: 255 }).notNull(),
    won: d.integer({ mode: "boolean" }).notNull().default(false),
  }),
  (t) => [
    index("match_participant_match_idx").on(t.matchId),
    index("match_participant_user_idx").on(t.userId),
    index("match_participant_username_idx").on(t.username),
  ],
);
