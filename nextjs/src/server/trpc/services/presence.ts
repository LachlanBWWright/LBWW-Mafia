import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "~/server/db";
import { userBlocks, userPresence, users } from "@mernmafia/db/schema";

const ONLINE_WINDOW_MS = 90_000;

export async function getPresenceMap(userIds: string[]) {
  if (!userIds.length) return new Map<string, Date>();
  const rows = await db
    .select({
      userId: userPresence.userId,
      lastSeenAt: userPresence.lastSeenAt,
    })
    .from(userPresence)
    .innerJoin(users, eq(users.id, userPresence.userId))
    .where(
      and(inArray(userPresence.userId, userIds), eq(users.hidePresence, false)),
    );
  return new Map(rows.map((row) => [row.userId, row.lastSeenAt]));
}

export function isOnline(lastSeenAt: Date | undefined) {
  return Boolean(
    lastSeenAt && lastSeenAt.getTime() > Date.now() - ONLINE_WINDOW_MS,
  );
}

export async function canInteractWithUser(
  userId: string,
  otherId: string,
  client: Pick<typeof db, "select"> = db,
) {
  const [blocked] = await client
    .select({ blockerId: userBlocks.blockerId })
    .from(userBlocks)
    .where(
      or(
        and(
          eq(userBlocks.blockerId, userId),
          eq(userBlocks.blockedId, otherId),
        ),
        and(
          eq(userBlocks.blockerId, otherId),
          eq(userBlocks.blockedId, userId),
        ),
      ),
    )
    .limit(1);
  return !blocked;
}

export async function markPresence(userId: string) {
  await db.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    if (
      !user ||
      user.deletedAt ||
      user.accountStatus !== "active" ||
      user.hidePresence
    )
      return;
    await tx
      .insert(userPresence)
      .values({ userId, lastSeenAt: new Date() })
      .onConflictDoUpdate({
        target: userPresence.userId,
        set: { lastSeenAt: new Date() },
      });
  });
}
