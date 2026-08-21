import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { AccountSettings } from "./account-settings";

const profile = {
  id: "u1",
  name: "Night Owl",
  handle: "nightowl",
  email: "owl@example.com",
  image: null,
  bio: "Town investigator.",
  profileVisibility: "public",
  historyVisibility: "friends",
  theme: "dark",
  reducedMotion: false,
  soundEnabled: true,
  notificationsEnabled: true,
  roles: ["player"],
};
const stats = {
  gamesPlayed: 128,
  wins: 82,
  losses: 46,
  winRate: 0.64,
  currentStreak: 3,
  bestWinStreak: 9,
  roles: [],
  factions: [],
};
const meta = {
  title: "Features/Account Settings",
  component: AccountSettings,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountSettings>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  args: { initialProfile: profile, initialStats: stats },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText("Display name");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    await expect(input).toHaveValue("New Name");
  },
};
