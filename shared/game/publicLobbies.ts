import { z } from "zod";
import { lobbyRoomIdSchema } from "./lobbyPreview";
import { MAX_PLAYERS } from "./gameNames";

export const publicLobbySchema = z.object({
  roomId: lobbyRoomIdSchema,
  name: z.string().min(1).max(60),
  players: z.number().int().min(0),
  capacity: z.number().int().min(2).max(MAX_PLAYERS),
  status: z.enum(["waiting", "in-progress", "finished"]),
});
export type PublicLobby = z.infer<typeof publicLobbySchema>;
export async function requestPublicLobbyPage(
  baseUrl = "",
  offset = 0,
  signal?: AbortSignal,
) {
  const response = await fetch(`${baseUrl}/api/lobbies?offset=${offset}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("Unable to load public lobbies.");
  return z
    .object({
      lobbies: z.array(publicLobbySchema),
      nextOffset: z.number().int().nonnegative().nullable().optional(),
    })
    .parse(await response.json());
}
export async function requestPublicLobbies(
  baseUrl = "",
  signal?: AbortSignal,
): Promise<PublicLobby[]> {
  return (await requestPublicLobbyPage(baseUrl, 0, signal)).lobbies;
}
