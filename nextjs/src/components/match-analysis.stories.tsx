import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { MatchReplayView, MatchBalanceView } from "./match-analysis";
import {
  replayFixture,
  balanceFixture,
} from "@mernmafia/shared/game/matchAnalysisFixtures";
const meta = {
  title: "Features/Match Analysis",
  component: MatchReplayView,
  args: { replay: replayFixture },
} satisfies Meta<typeof MatchReplayView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Replay: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Protected Sam.")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Conversation" }));
    await expect(
      canvas.getByText("Alex's claim does not add up."),
    ).toBeVisible();
    await expect(canvas.queryByText("Protected Sam.")).not.toBeInTheDocument();
  },
};
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
