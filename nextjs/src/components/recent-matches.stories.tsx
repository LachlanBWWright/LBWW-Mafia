import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { RecentMatchesView } from "./recent-matches";

const matches = [
  {
    id: 1042,
    roomName: "Friday Night",
    endedAt: new Date("2026-08-12T10:30:00Z"),
    winningFaction: "Town",
    winningRoles: ["Doctor", "Investigator"],
    participants: [],
    conversationCount: 43,
    actionCount: 18,
  },
];
const meta = {
  title: "Features/Recent Matches",
  component: RecentMatchesView,
  args: { title: "Recent matches" },
} satisfies Meta<typeof RecentMatchesView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: { matches },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Match #1042/)).toBeVisible();
  },
};
export const Loading: Story = { args: { hasLoaded: false } };
export const Empty: Story = { args: { matches: [] } };
export const Error: Story = {
  args: { error: "Match history is temporarily unavailable." },
};
export const MissingUsername: Story = { args: { canLoad: false } };
