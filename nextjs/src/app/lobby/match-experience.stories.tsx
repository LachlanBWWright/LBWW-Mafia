import { useReducer } from "react";
import LobbyClient from "./LobbyClient";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  nightMatch,
  dayMatch,
  hiddenMatch,
  recapMatch,
  reconnectMatch,
  fixtureLobbyActions,
} from "@mernmafia/shared/testing/matchFixtures";
import {
  lobbyReducer,
  type LobbyState,
} from "@mernmafia/shared/game/lobbyState";
import { LobbyView } from "./LobbyView";
const noop = () => undefined;
function MatchExperience({ lobby: initialLobby }: { lobby: LobbyState }) {
  const [state, dispatch] = useReducer(lobbyReducer, initialLobby);
  const actions = {
    ...fixtureLobbyActions,
    setMessageDraft: (value: string) =>
      dispatch({ type: "patch", value: { messageDraft: value } }),
    visitPlayer: (index: number) => {
      const target = state.players[index];
      if (target)
        dispatch({
          type: "patch",
          value: {
            action: {
              visit: target.name,
              outcome: "submitted",
              feedback: `Night action selected: ${target.name}. You can change it until dawn.`,
            },
          },
        });
    },
    voteForPlayer: (index: number | null) => {
      const target = index === null ? null : state.players[index]?.name;
      if (target !== undefined)
        dispatch({
          type: "patch",
          value: {
            action: {
              vote: target,
              outcome: "submitted",
              feedback:
                target === null
                  ? "Abstained."
                  : `Vote submitted for ${target}.`,
            },
          },
        });
    },
    cancelVisit: () =>
      dispatch({
        type: "patch",
        value: {
          action: { outcome: "resolved", feedback: "Night action cancelled." },
        },
      }),
    readyForRematch: () =>
      dispatch({
        type: "patch",
        value: {
          readyPlayers: [
            ...new Set([...(state.readyPlayers ?? []), state.playerName]),
          ],
        },
      }),
    dismissRecovery: () =>
      dispatch({ type: "patch", value: { recoveryNotice: "" } }),
    sendMessage: () => {
      if (!state.messageDraft.trim()) return;
      dispatch({
        type: "message",
        kind: "chat",
        sender: state.playerName,
        text: `${state.playerName}: ${state.messageDraft.trim()}`,
      });
      dispatch({ type: "patch", value: { messageDraft: "" } });
    },
    whisperToPlayer: (index: number) => {
      const target = state.players[index];
      if (!target || !state.messageDraft.trim()) return;
      dispatch({
        type: "message",
        kind: "whisper",
        text: `Whisper to ${target.name}: ${state.messageDraft.trim()}`,
      });
      dispatch({ type: "patch", value: { messageDraft: "" } });
    },
  };
  return (
    <LobbyView
      lobby={{ ...state, ...actions }}
      roomId="story-match"
      practice={false}
      onPracticeChange={noop}
      onSpectate={noop}
    />
  );
}
const meta = {
  title: "Game/Match experience",
  component: MatchExperience,
  parameters: { layout: "fullscreen" },
  args: { lobby: nightMatch },
} satisfies Meta<typeof MatchExperience>;
export default meta;
type Story = StoryObj<typeof meta>;
export const NightAction: Story = {};
export const Voting: Story = { args: { lobby: dayMatch } };
export const HiddenVotes: Story = { args: { lobby: hiddenMatch } };
export const Reconnecting: Story = { args: { lobby: reconnectMatch } };
export const Recap: Story = { args: { lobby: recapMatch } };

export const Practice: Story = {
  render: () => <LobbyClient roomId="practice" initialPractice />,
};

export const VotingOpen: Story = {
  args: { lobby: { ...dayMatch, action: {}, canTalk: true } },
};
export const LongRoster: Story = {
  args: {
    lobby: {
      ...nightMatch,
      players: [
        ...nightMatch.players,
        ...Array.from({ length: 26 }, (_, index) => ({
          name: `Player ${index + 5}`,
          isAlive: true,
          connected: true,
        })),
      ],
    },
  },
};
