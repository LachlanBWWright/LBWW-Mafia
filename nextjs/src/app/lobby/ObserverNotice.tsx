import type { LobbyState } from "@mernmafia/shared/game/lobbyState";
export function ObserverNotice({ lobby }: { lobby: LobbyState }) {
  if (
    lobby.participation !== "spectator" &&
    lobby.participation !== "eliminated"
  )
    return null;
  return (
    <p role="status" className="border-b py-2 text-sm">
      {lobby.participation === "spectator" ? "Spectating" : "Eliminated"} ·
      Spectator chat · {lobby.spectatorCount ?? 0} watching
    </p>
  );
}
