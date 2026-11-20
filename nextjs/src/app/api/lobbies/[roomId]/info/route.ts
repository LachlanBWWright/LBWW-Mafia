import { eq } from "drizzle-orm";
import { customLobbies, users } from "@mernmafia/db/schema";
import { lobbyRoomIdSchema } from "@mernmafia/shared/game/lobbyPreview";
import { lobbyConfigSchema } from "@mernmafia/shared/game/lobbyConfig";
import { db } from "~/server/db";
import { env } from "~/env";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  if (!lobbyRoomIdSchema.safeParse(roomId).success)
    return Response.json({ error: "Invalid lobby." }, { status: 400 });
  try {
    const [row] = await db
      .select({ config: customLobbies.config, hostName: users.name })
      .from(customLobbies)
      .leftJoin(users, eq(users.id, customLobbies.ownerId))
      .where(eq(customLobbies.roomId, roomId))
      .limit(1);
    if (!row)
      return Response.json({ error: "Lobby not found." }, { status: 404 });
    const config = lobbyConfigSchema.parse(JSON.parse(row.config));
    const response = await fetch(
      `${env.NEXT_PUBLIC_SOCKET_URL.replace(/\/$/, "")}/parties/main/${encodeURIComponent(roomId)}`,
      {
        headers: { authorization: `Bearer ${env.BACKEND_SECRET}` },
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!response.ok) throw new Error("Lobby unavailable");
    const state = (await response.json()) as {
      players?: unknown;
      started?: unknown;
      ended?: unknown;
      closed?: unknown;
    };
    if (
      typeof state.players !== "number" ||
      !Number.isInteger(state.players) ||
      state.players < 0 ||
      state.players > config.size ||
      typeof state.started !== "boolean" ||
      typeof state.ended !== "boolean" ||
      typeof state.closed !== "boolean"
    )
      throw new Error("Invalid lobby state");
    const status = state.closed
      ? "closed"
      : state.ended
        ? "finished"
        : state.started
          ? "in-progress"
          : state.players >= config.size
            ? "full"
            : "waiting";
    return Response.json(
      {
        roomId,
        name: config.directory?.public
          ? config.directory.name
          : "Private lobby",
        visibility: config.directory?.public ? "public" : "link-only",
        hostName: row.hostName,
        players: state.players,
        capacity: config.size,
        status,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Unable to load lobby." }, { status: 503 });
  }
}
