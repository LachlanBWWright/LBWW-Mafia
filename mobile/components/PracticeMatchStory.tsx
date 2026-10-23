import { View } from "react-native";
import * as React from "react";
import { useMemo } from "react";
import { createUseSharedGameLobby } from "../../shared/game/useGameLobby";
import { PracticeSocket } from "../../shared/game/practiceSocket";
import { LobbyView } from "./LobbyView";

const useLobby = createUseSharedGameLobby(React);
const ticket = async () => undefined;
const ignorePracticeChange = (_value: boolean) => undefined;
const ignoreSpectate = () => undefined;

export function PracticeMatchStory() {
  const socket = useMemo(() => new PracticeSocket(), []);
  const lobby = useLobby(socket, ticket);
  return (
    <View className="flex-1 w-full">
      <LobbyView
        lobby={lobby}
        roomId="practice"
        practice
        onPracticeChange={ignorePracticeChange}
        onSpectate={ignoreSpectate}
      />
    </View>
  );
}
