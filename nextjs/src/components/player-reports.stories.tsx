import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PlayerReports } from "./player-reports";
import { reportFixtures } from "@mernmafia/shared/testing/accountSocialFixtures";
const meta = {
  title: "Features/Player reports",
  component: PlayerReports,
  args: { initialReports: reportFixtures },
} satisfies Meta<typeof PlayerReports>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Outcomes: Story = {};
export const Moderation: Story = { args: { moderation: true } };
export const Empty: Story = { args: { initialReports: [] } };
