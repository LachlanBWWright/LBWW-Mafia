import { Text } from "react-native";
import type { LobbyState } from "../../shared/game/lobbyState";
export function ObserverNotice({ lobby }: { lobby: LobbyState }) {
  if (
    lobby.participation !== "spectator" &&
    lobby.participation !== "eliminated"
  )
    return null;
  return (
    <Text accessibilityRole="alert" className="text-sm text-foreground">
      {lobby.participation === "spectator" ? "Spectating" : "Eliminated"} ·
      Spectator chat · {lobby.spectatorCount ?? 0} watching
    </Text>
  );
}
