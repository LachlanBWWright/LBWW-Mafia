import { parseLobbyLink } from "./lobbyLinks";
/** Only trusted app links may select a room; credentials are never part of this state. */
export function lobbyNavigationFromUrl(url: string, websiteOrigin: string) {
  const roomId = parseLobbyLink(url, websiteOrigin);
  if (!roomId) return undefined;
  const query = new URL(url).searchParams;
  return {
    routes: [
      {
        name: "Lobby" as const,
        params: {
          roomId,
          spectator:
            query.getAll("spectate").length === 1 &&
            query.get("spectate") === "1",
        },
      },
    ],
  };
}
