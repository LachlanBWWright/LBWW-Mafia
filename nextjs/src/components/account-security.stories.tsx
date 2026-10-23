import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AccountSecurity } from "./account-security";
const meta = {
  title: "Features/Account security",
  component: AccountSecurity,
  parameters: { nextjs: { appDirectory: true } },
  args: { initialSessions: [] },
} satisfies Meta<typeof AccountSecurity>;
export default meta;
type Story = StoryObj<typeof meta>;
export const NoDevices: Story = {};
export const Devices: Story = {
  args: {
    initialSessions: [
      { id: "phone", deviceName: "iPhone", createdAt: new Date("2026-10-04") },
    ],
  },
};
