import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { activeRoom } from "@mernmafia/db/schema";
import LobbyClient from "./LobbyClient";

export const dynamic = "force-dynamic";

export default async function LobbyPage() {
  const rows = await db
    .select({ roomId: activeRoom.roomId })
    .from(activeRoom)
    .where(eq(activeRoom.id, 1));

  const existing = rows[0];
  if (existing) {
    return <LobbyClient roomId={existing.roomId} />;
  }

  const roomId = crypto.randomUUID();
  await db.insert(activeRoom).values({ id: 1, roomId });
  return <LobbyClient roomId={roomId} />;
}
