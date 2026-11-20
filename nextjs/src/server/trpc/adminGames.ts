import { desc, eq, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import {
  activeRoom,
  customLobbies,
  quickJoinRooms,
} from "@mernmafia/db/schema";
import {
  adminRoomStateSchema,
  type AdminGame,
  type AdminGameQuery,
  type AdminGamePage,
} from "@mernmafia/shared/admin/games";
import { lobbyConfigSchema } from "@mernmafia/shared/game/lobbyConfig";
import { db } from "~/server/db";
import { env } from "~/env";

export async function readAdminGame(
  room: Omit<AdminGame, "state">,
  request = fetch,
): Promise<AdminGame> {
  try {
    const response = await request(
      `${env.NEXT_PUBLIC_SOCKET_URL.replace(/\/$/, "")}/parties/main/${encodeURIComponent(room.roomId)}`,
      {
        headers: { authorization: `Bearer ${env.BACKEND_SECRET}` },
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!response.ok) throw new Error("Room unavailable");
    return {
      ...room,
      state: adminRoomStateSchema.parse(await response.json()),
    };
  } catch {
    return { ...room, state: null };
  }
}

export async function listAdminGames({
  offset,
  roomId,
}: AdminGameQuery): Promise<AdminGamePage> {
  const pageSize = 10;
  const directory = unionAll(
    db
      .select({
        roomId: customLobbies.roomId,
        config: sql<string | null>`${customLobbies.config}`.as("config"),
        createdAt: customLobbies.createdAt,
      })
      .from(customLobbies)
      .where(roomId ? eq(customLobbies.roomId, roomId) : undefined),
    db
      .select({
        roomId: quickJoinRooms.roomId,
        config: sql<string | null>`null`.as("config"),
        createdAt: quickJoinRooms.createdAt,
      })
      .from(quickJoinRooms)
      .where(roomId ? eq(quickJoinRooms.roomId, roomId) : undefined),
  ).as("directory");
  const [rows, current] = await Promise.all([
    db
      .select()
      .from(directory)
      .orderBy(desc(directory.createdAt), desc(directory.roomId))
      .limit(pageSize + 1)
      .offset(roomId ? 0 : offset),
    db
      .select({ roomId: activeRoom.roomId })
      .from(activeRoom)
      .where(eq(activeRoom.id, 1))
      .limit(1),
  ]);
  const rooms: Omit<AdminGame, "state">[] = rows
    .slice(0, pageSize)
    .map((row) => {
      if (row.config === null)
        return { roomId: row.roomId, name: "Quick join", visibility: "public" };
      let directory;
      try {
        directory = lobbyConfigSchema.parse(JSON.parse(row.config)).directory;
      } catch {
        /* Keep malformed rooms visible for review. */
      }
      return {
        roomId: row.roomId,
        name: directory?.name ?? "Private lobby",
        visibility: directory?.public ? "public" : "link-only",
      };
    });
  const active = current[0];
  if (
    active &&
    (!roomId ? offset === 0 : active.roomId === roomId) &&
    !rooms.some((room) => room.roomId === active.roomId)
  ) {
    rooms.unshift({
      roomId: active.roomId,
      name: "Quick join",
      visibility: "public",
    });
  }
  const games: AdminGame[] = [];
  for (let index = 0; index < rooms.length; index += 4) {
    games.push(
      ...(await Promise.all(
        rooms.slice(index, index + 4).map((room) => readAdminGame(room)),
      )),
    );
  }
  return {
    games,
    nextOffset: !roomId && rows.length > pageSize ? offset + pageSize : null,
    checkedAt: new Date().toISOString(),
  };
}
