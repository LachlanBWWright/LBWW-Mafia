import { View } from "react-native";
import type { LobbyState } from "../../shared/game/lobbyState";
import { fixtureLobbyActions } from "../../shared/testing/matchFixtures";
import { LobbyView } from "./LobbyView";

const ignorePracticeChange = (_value: boolean) => undefined;
const ignoreSpectate = () => undefined;

export function MatchExperienceStory({ lobby }: { lobby: LobbyState }) {
  return (
    <View className="flex-1 w-full">
      <LobbyView
        lobby={{ ...lobby, ...fixtureLobbyActions }}
        roomId="storybook-match"
        onPracticeChange={ignorePracticeChange}
        onSpectate={ignoreSpectate}
        initialTab="players"
      />
    </View>
  );
}
