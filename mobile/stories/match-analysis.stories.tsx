import type { Meta, StoryObj } from "@storybook/react-native";
import { MatchReplayView, MatchBalanceView } from "../components/MatchAnalysis";
import {
  replayFixture,
  balanceFixture,
} from "../../shared/game/matchAnalysisFixtures";
const meta = {
  title: "Features/Match Analysis",
  component: MatchReplayView,
  args: { replay: replayFixture },
} satisfies Meta<typeof MatchReplayView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Replay: Story = {};
export const EmptyReplay: Story = {
  args: { replay: { ...replayFixture, events: [] } },
};
export const Balance: Story = {
  render: () => <MatchBalanceView balance={balanceFixture} />,
};
export const EmptyBalance: Story = {
  render: () => (
    <MatchBalanceView
      balance={{
        sampleSize: 0,
        draws: 0,
        roles: [],
        factions: [],
        compositions: [],
      }}
    />
  ),
};
