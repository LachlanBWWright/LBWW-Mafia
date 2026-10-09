import { guardRequest, readJson } from "~/server/reliability/requests";
import { lobbyConfigSchema } from "@mernmafia/shared/game/lobbyConfig";
import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { eq } from "drizzle-orm";
import { customLobbies, users } from "@mernmafia/db/schema";
import { verifyMobileToken } from "~/server/auth/mobileToken";
import { getActiveIdentity } from "~/server/auth/identity";

export const dynamic = "force-dynamic";

/** Creates a PartyKit room with a declarative role-selection configuration. */
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
    console.error("Unable to register PartyKit lobby", { roomId, error });
    return NextResponse.json(
      { error: "Unable to create lobby." },
      { status: 500 },
    );
  }
  return NextResponse.json({ roomId });
}
