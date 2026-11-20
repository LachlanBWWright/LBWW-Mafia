import { guardRequest, readJson } from "~/server/reliability/requests";
import { lobbyConfigSchema } from "@mernmafia/shared/game/lobbyConfig";
import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { desc, eq, sql } from "drizzle-orm";
import { env } from "~/env";
import { customLobbies, users } from "@mernmafia/db/schema";
import { verifyMobileToken } from "~/server/auth/mobileToken";
import { getActiveIdentity } from "~/server/auth/identity";

export const dynamic = "force-dynamic";

/** Creates a PartyServer room with a declarative role-selection configuration. */
export async function POST(request: Request) {
  const limited = await guardRequest(request, "lobby-create", 20);
  if (limited) return limited;
  const session = await auth();
  const bearer = request.headers.get("authorization");
  const mobileUser = bearer?.startsWith("Bearer ")
    ? await verifyMobileToken(bearer.slice("Bearer ".length))
    : null;
  const sessionIdentity = session?.user?.id
    ? await getActiveIdentity(session.user.id)
    : null;
  const mobileIdentity = mobileUser
    ? await getActiveIdentity(mobileUser.sub)
    : null;
  const ownerId = sessionIdentity?.id ?? mobileIdentity?.id;
  if (!ownerId)
    return NextResponse.json(
      { error: "Sign in to create a lobby." },
      { status: 401 },
    );
  let body: unknown;
  try {
    body = await readJson(request);
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = lobbyConfigSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Invalid lobby configuration.",
      },
      { status: 400 },
    );

  const roomId = crypto.randomUUID();
  try {
    await db.transaction(async (tx) => {
      const [owner] = await tx
        .select()
        .from(users)
        .where(eq(users.id, ownerId))
        .for("update");
      if (!owner || owner.deletedAt || owner.accountStatus !== "active")
        throw new Error("Account unavailable");
      await tx
        .insert(customLobbies)
        .values({ roomId, ownerId, config: JSON.stringify(parsed.data) });
    });
  } catch (error) {
    console.error("Unable to register PartyServer lobby", { roomId, error });
    return NextResponse.json(
      { error: "Unable to create lobby." },
      { status: 500 },
    );
  }
  return NextResponse.json({ roomId });
}

/** Return explicitly public rooms with live state from the game server. */
export async function GET(request: Request) {
  const limited = await guardRequest(request, "lobby-list", 60);
  if (limited) return limited;
  try {
    const offsetValue = new URL(request.url).searchParams.get("offset") ?? "0";
    if (!/^\d{1,7}$/.test(offsetValue))
      return NextResponse.json({ error: "Invalid page." }, { status: 400 });
    const offset = Number(offsetValue);
    const pageSize = 50;
    const rows = await db
      .select({ roomId: customLobbies.roomId, config: customLobbies.config })
      .from(customLobbies)
      .where(
        sql`(${customLobbies.config}::jsonb -> 'directory' ->> 'public') = 'true'`,
      )
      .orderBy(desc(customLobbies.createdAt), desc(customLobbies.roomId))
      .limit(pageSize + 1)
      .offset(offset);
    const visible = rows.slice(0, pageSize).flatMap((row) => {
      try {
        const parsed = lobbyConfigSchema.safeParse(JSON.parse(row.config));
        return parsed.success && parsed.data.directory?.public
          ? [
              {
                roomId: row.roomId,
                name: parsed.data.directory.name,
                capacity: parsed.data.size,
              },
            ]
          : [];
      } catch {
        return [];
      }
    });
    let reachable = 0;
    const rooms = await Promise.all(
      visible.map(async (room) => {
        try {
          const response = await fetch(
            `${env.NEXT_PUBLIC_SOCKET_URL.replace(/\/$/, "")}/parties/main/${encodeURIComponent(room.roomId)}`,
            {
              headers: { authorization: `Bearer ${env.BACKEND_SECRET}` },
              signal: AbortSignal.timeout(3000),
              cache: "no-store",
            },
          );
          if (!response.ok) return null;
          reachable++;
          const state = (await response.json()) as {
            players?: unknown;
            started?: unknown;
            ended?: unknown;
            closed?: unknown;
          };
          if (
            state.closed ||
            typeof state.players !== "number" ||
            !Number.isInteger(state.players) ||
            state.players < 1 ||
            state.players > room.capacity ||
            typeof state.started !== "boolean" ||
            typeof state.ended !== "boolean"
          )
            return null;
          return {
            ...room,
            players: state.players,
            status: state.ended
              ? "finished"
              : state.started
                ? "in-progress"
                : "waiting",
          };
        } catch {
          return null;
        }
      }),
    );
    if (visible.length > 0 && reachable === 0) {
      return NextResponse.json(
        { error: "Unable to load public lobbies." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        lobbies: rooms.filter(Boolean),
        nextOffset: rows.length > pageSize ? offset + pageSize : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to load public lobbies." },
      { status: 503 },
    );
  }
}
