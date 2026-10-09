import { verifyMobileToken } from "~/server/auth/mobileToken";
import { env } from "~/env";
import { lobbyConfigSchema } from "@mernmafia/shared/game/lobbyConfig";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { customLobbies } from "@mernmafia/db/schema";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getActiveIdentity } from "~/server/auth/identity";

export const dynamic = "force-dynamic";

/** Deletes the ownership record for a PartyKit lobby when requested by its owner. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const session = await auth();
  const bearer = request.headers.get("authorization");
  const mobile = bearer?.startsWith("Bearer ")
    ? await verifyMobileToken(bearer.slice(7))
    : null;
  const userId = session?.user?.id ?? mobile?.sub;
  const identity = userId ? await getActiveIdentity(userId) : null;
  if (!identity)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { roomId } = await params;
  const [lobby] = await db
    .select({ ownerId: customLobbies.ownerId })
    .from(customLobbies)
    .where(
      and(
        eq(customLobbies.roomId, roomId),
        eq(customLobbies.ownerId, identity.id),
      ),
    )
    .limit(1);
  if (!lobby)
    return NextResponse.json({ error: "Lobby not found." }, { status: 404 });

  try {
    const host = env.NEXT_PUBLIC_SOCKET_URL.replace(/\/$/, "");
    const response = await fetch(
      `${host}/parties/main/${encodeURIComponent(roomId)}`,
      {
        signal: AbortSignal.timeout(10_000),
        method: "DELETE",
        headers: { authorization: `Bearer ${env.BACKEND_SECRET}` },
      },
    );
    if (!response.ok)
      return NextResponse.json(
        { error: "Unable to close lobby. Try again." },
        { status: 503 },
      );
    await db.transaction(async (tx) => {
      await tx
        .delete(customLobbies)
        .where(
          and(
            eq(customLobbies.roomId, roomId),
            eq(customLobbies.ownerId, identity.id),
          ),
        );
    });
  } catch (error) {
    console.error("PartyKit lobby ownership record could not be removed", {
      roomId,
      error,
    });
    return NextResponse.json(
      { error: "Lobby closed, but cleanup is pending." },
      { status: 503 },
    );
  }

  return new Response(null, { status: 204 });
}

/** Only the game host may retrieve the immutable lobby rules. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  if (request.headers.get("authorization") !== `Bearer ${env.BACKEND_SECRET}`)
    return new Response("Unauthorized", { status: 401 });
  if (env.PLAYWRIGHT_NO_DB === "true")
    return new Response("Not found", { status: 404 });
  const { roomId } = await params;
  const [lobby] = await db
    .select({ config: customLobbies.config })
    .from(customLobbies)
    .where(eq(customLobbies.roomId, roomId))
    .limit(1);
  if (!lobby) return new Response("Not found", { status: 404 });
  const config = lobbyConfigSchema.safeParse(JSON.parse(lobby.config));
  if (!config.success)
    return new Response("Invalid stored configuration", { status: 500 });
  return NextResponse.json(config.data);
}
