import { fixtureFeaturePreferences } from "@mernmafia/shared/testing/accountFixtures";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { AccountSettings } from "./account-settings";
import {
  fixtureProfile,
  fixtureStats,
} from "@mernmafia/shared/testing/fixtures";

const meta = {
  title: "Features/Account Settings",
  component: AccountSettings,
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
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
  args: {
    initialProfile: fixtureProfile,
    initialStats: fixtureStats,
    initialPreferences: fixtureFeaturePreferences,
  },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText("Display name");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    await expect(input).toHaveValue("New Name");
  },
};
