import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PlayerInsights } from "./player-insights";
import {
  fixtureAchievements,
  fixtureDetailedStats,
} from "@mernmafia/shared/testing/accountFixtures";
import { fixtureProfile } from "@mernmafia/shared/testing/fixtures";
const meta = {
  title: "Features/Player insights",
  component: PlayerInsights,
  args: {
    initialProfile: { ...fixtureProfile, avatarPreset: "fox" },
    initialStats: fixtureDetailedStats,
    initialAchievements: fixtureAchievements,
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlayerInsights>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Statistics: Story = {};
