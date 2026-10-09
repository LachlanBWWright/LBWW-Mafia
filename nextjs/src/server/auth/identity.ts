import { and, eq, isNull } from "drizzle-orm";
import { users, userRoles } from "@mernmafia/db/schema";
import type { SessionUser } from "@mernmafia/shared/trpc/appRouter";
import { db } from "~/server/db";

/** Resolves both web and mobile credentials against the current account row. */
export async function getActiveIdentity(
  userId: string,
): Promise<SessionUser | null> {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      handle: users.handle,
      isAdmin: users.isAdmin,
    })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.accountStatus, "active"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  if (!user) return null;
  const roles = (
    await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, userId))
  ).map((row) => row.role);
  return {
    id: user.id,
    name: user.name,
    handle: user.handle,
    isAdmin: user.isAdmin || roles.includes("administrator"),
    roles: roles.length ? roles : [user.isAdmin ? "administrator" : "player"],
  };
}
