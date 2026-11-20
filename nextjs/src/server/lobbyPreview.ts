import { eq } from "drizzle-orm";
import { customLobbies } from "@mernmafia/db/schema";
import { lobbyConfigSchema } from "@mernmafia/shared/game/lobbyConfig";
import {
  createLobbyPreview,
  lobbyRoomIdSchema,
} from "@mernmafia/shared/game/lobbyPreview";
import { db } from "~/server/db";
export async function loadLobbyPreview(roomId: string) {
  lobbyRoomIdSchema.parse(roomId);
  const [row] = await db
    .select({ config: customLobbies.config })
    .from(customLobbies)
    .where(eq(customLobbies.roomId, roomId))
    .limit(1);
  if (!row) return null;
  if (row.config.length > 300000) throw new Error("Invalid stored game setup.");
  const config: unknown = JSON.parse(row.config);
  return createLobbyPreview(roomId, lobbyConfigSchema.parse(config));
}
