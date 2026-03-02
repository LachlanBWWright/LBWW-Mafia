/**
 * SQLite schema for the game server.
 * Mirrors the Postgres schema in db/schema.ts using SQLite-compatible column types.
 * Table names include the `nextjs_` prefix to match the shared Postgres schema.
 */
import {
  integer,
  sqliteTableCreator,
  text,
} from "drizzle-orm/sqlite-core";

const createTable = sqliteTableCreator((name) => `nextjs_${name}`);

export const matches = createTable("match", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  roomName: text("room_name").notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp_ms" }).notNull(),
  winningFaction: text("winning_faction").notNull(),
  winningRoles: text("winning_roles").notNull(),
  playerCount: integer("player_count").notNull(),
  conversationHistory: text("conversation_history").notNull(),
  actionHistory: text("action_history").notNull(),
});

export const matchParticipants = createTable("match_participant", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  username: text("username").notNull(),
  role: text("role").notNull(),
  won: integer("won", { mode: "boolean" }).notNull().default(false),
});
