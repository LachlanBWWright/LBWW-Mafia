import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "~/server/db";
import { friendships, userBlocks } from "@mernmafia/db/schema";
import type { Relationship } from "@mernmafia/shared/trpc/appRouter";

/** Fetch relationships in two queries regardless of result count. */
export async function getRelationshipMap(userId: string, otherIds: string[]) {
  const result = new Map<string, Relationship>();
  if (!otherIds.length) return result;
  const [blocks, relations] = await Promise.all([
    db
      .select()
      .from(userBlocks)
      .where(
        or(
          and(
            eq(userBlocks.blockerId, userId),
            inArray(userBlocks.blockedId, otherIds),
          ),
          and(
            eq(userBlocks.blockedId, userId),
            inArray(userBlocks.blockerId, otherIds),
          ),
        ),
      ),
    db
      .select()
      .from(friendships)
      .where(
        or(
          and(
            eq(friendships.requesterId, userId),
            inArray(friendships.addresseeId, otherIds),
          ),
          and(
            eq(friendships.addresseeId, userId),
            inArray(friendships.requesterId, otherIds),
          ),
        ),
      ),
  ]);
  for (const relation of relations) {
    const other =
      relation.requesterId === userId
        ? relation.addresseeId
        : relation.requesterId;
    result.set(
      other,
      relation.status === "accepted"
        ? "friend"
        : relation.requesterId === userId
          ? "outgoing"
          : "incoming",
    );
  }
  for (const block of blocks)
    result.set(
      block.blockerId === userId ? block.blockedId : block.blockerId,
      "blocked",
    );
  return result;
}
