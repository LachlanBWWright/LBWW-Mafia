import { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { StackParamList } from "../App";
import { authIdentity } from "../lib/authIdentity";
import { useAppState } from "../context/AppStateContext";
import { Screen } from "../components/ui";
import { LobbyView } from "../components/LobbyView";
import { useGameLobby } from "../lib/useGameLobby";

export function LobbyScreen({
  navigation,
  route,
}: NativeStackScreenProps<StackParamList, "Lobby">) {
  const { setPlayerName, setLastRoomName, authToken } = useAppState();
  const roomId =
    route.params?.roomId ?? process.env.EXPO_PUBLIC_PARTYSERVER_ROOM ?? "default";
  const [practice, setPractice] = useState(false);
  const [watchChoice, setWatchChoice] = useState<{
    routeKey: string;
    value: boolean;
  }>();
  const routeKey = `${roomId}:${route.params?.spectator ?? false}`;
  const spectating = watchChoice?.routeKey === routeKey
    ? watchChoice.value : (route.params?.spectator ?? false);
  const lobby = useGameLobby(
    roomId,
    practice,
    spectating ? "spectator" : "player",
    authToken ? authIdentity(authToken) : "guest",
  );
  useEffect(() => {
    if (lobby.playerName.trim() && !practice) {
      setPlayerName(lobby.playerName);
      setLastRoomName(roomId);
    }
  }, [lobby.playerName, roomId, practice, setLastRoomName, setPlayerName]);
  return (
    <Screen navigation={navigation} activeRoute="Lobby" title="Lobby" scroll={false}>
      <LobbyView
        lobby={lobby}
        roomId={roomId}
        practice={practice}
        onPracticeChange={setPractice}
        spectating={spectating}
        onSpectate={() => setWatchChoice({ routeKey, value: true })}
        authToken={authToken ?? undefined}
        onFollowRoom={(nextRoom) => navigation.setParams({ roomId: nextRoom })}
      />
    </Screen>
  );
}
