import { View, Text } from "react-native";
import type { Meta, StoryObj } from "@storybook/react-native";
import type { LobbyState } from "../../shared/game/lobbyState";
import {
  spectatorMatch,
  eliminatedMatch,
} from "../../shared/testing/spectatorFixtures";
import { ObserverNotice } from "../components/ObserverNotice";
import { ChatLog, PhaseHeader } from "../components/MatchPanels";
function ObserverView({ lobby }: { lobby: LobbyState }) {
  return (
    <View className="gap-2">
      <PhaseHeader lobby={lobby} />
      <ObserverNotice lobby={lobby} />
      <View className="h-64">
        <ChatLog messages={lobby.messages} muted={false} />
      </View>
      {lobby.players.map((player) => (
        <Text
          key={player.name}
          className="border-b border-border py-2 text-sm text-foreground"
        >
          {player.name}
          {player.role ? ` · ${player.role}` : ""}
        </Text>
      ))}
    </View>
  );
}
const meta = {
  title: "Features/Spectators",
  component: ObserverView,
  args: { lobby: spectatorMatch },
} satisfies Meta<typeof ObserverView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Watching: Story = {};
export const Eliminated: Story = { args: { lobby: eliminatedMatch } };
