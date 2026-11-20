import { z } from "zod";
import { lobbyRoomIdSchema } from "./lobbyPreview";
export const lobbyInfoSchema = z.object({
  roomId: lobbyRoomIdSchema,
  name: z.string(),
  hostName: z.string().nullable(),
  visibility: z.enum(["public", "link-only"]),
  players: z.number().int().nonnegative(),
  capacity: z.number().int().positive(),
  status: z.enum(["waiting", "full", "in-progress", "finished", "closed"]),
});
export type LobbyInfo = z.infer<typeof lobbyInfoSchema>;
export async function requestLobbyInfo(
  roomId: string,
  baseUrl = "",
): Promise<LobbyInfo | null> {
  lobbyRoomIdSchema.parse(roomId);
  const response = await fetch(
    `${baseUrl}/api/lobbies/${encodeURIComponent(roomId)}/info`,
    { cache: "no-store", signal: AbortSignal.timeout(5000) },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Unable to load lobby.");
  const info = lobbyInfoSchema.parse(await response.json());
  if (info.roomId !== roomId) throw new Error("Lobby mismatch.");
  return info;
}
