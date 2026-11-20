import { eq, sql } from "drizzle-orm";
import { activeRoom, quickJoinRooms } from "@mernmafia/db/schema";
import { db } from "~/server/db";

/** Advance quick join while retaining both rooms for administrative review. */
export const rotateActiveRoom = async (): Promise<{ roomId: string }> => {
  const roomId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    const previous = await tx
      .select({ roomId: activeRoom.roomId })
      .from(activeRoom)
      .where(eq(activeRoom.id, 1))
      .for("update");
    const roomIds = [
      ...new Set([roomId, ...previous.map((room) => room.roomId)]),
    ];
    await tx
      .insert(quickJoinRooms)
      .values(roomIds.map((id) => ({ roomId: id })))
      .onConflictDoNothing();
    await tx
      .insert(activeRoom)
      .values({ id: 1, roomId })
      .onConflictDoUpdate({
        target: activeRoom.id,
        set: { roomId, updatedAt: sql`now()` },
      });
  });
  return { roomId };
};
