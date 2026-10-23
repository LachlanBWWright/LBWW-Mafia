import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { LobbyState } from "@mernmafia/shared/game/lobbyState";
import {
  spectatorMatch,
  eliminatedMatch,
} from "@mernmafia/shared/testing/spectatorFixtures";
import { ObserverNotice } from "./ObserverNotice";
import { ChatLog, PhaseHeader } from "./MatchPanels";
function ObserverView({ lobby }: { lobby: LobbyState }) {
  return (
    <div className="mx-auto max-w-xl p-4">
      <PhaseHeader lobby={lobby} />
      <ObserverNotice lobby={lobby} />
      <div className="flex h-64 flex-col">
        <ChatLog messages={lobby.messages} muted={false} />
      </div>
      <ul>
        {lobby.players.map((player) => (
          <li key={player.name} className="border-b py-2 text-sm">
            {player.name}
            {player.role ? ` · ${player.role}` : ""}
          </li>
        ))}
      </ul>
    </div>
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
