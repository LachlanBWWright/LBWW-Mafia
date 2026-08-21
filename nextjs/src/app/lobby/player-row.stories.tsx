import { DayTime } from "@mernmafia/shared/game/playerActionRules";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { PlayerRow } from "./LobbyClient";

const onVote = fn();
const capability = {
  dayVisitSelf: false,
  dayVisitOthers: true,
  dayVisitFaction: false,
  nightVisitSelf: false,
  nightVisitOthers: true,
  nightVisitFaction: false,
};
const meta = {
  title: "Features/Player Row",
  component: PlayerRow,
  args: {
    player: { name: "Mira", isAlive: true, role: "Doctor" },
    index: 1,
    playerName: "Lachlan",
    time: DayTime.Day,
    isCurrentUserAlive: true,
    currentUserRole: "Investigator",
    visitCapability: capability,
    canVote: true,
    messageDraft: "Meet me tonight",
    onVote,
    onVisit: fn(),
    onWhisper: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlayerRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const DayActions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Vote player" }));
    await expect(onVote).toHaveBeenCalledWith(1);
  },
};
export const DeadPlayer: Story = {
  args: { player: { name: "Mira", isAlive: false, role: "Doctor" } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Vote player" }),
    ).toBeDisabled();
  },
};
export const NightActions: Story = { args: { time: DayTime.Night } };
