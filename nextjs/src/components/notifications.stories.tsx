import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, expect, userEvent, within } from "storybook/test";
import { NotificationsView } from "./notifications";
import {
  notificationFixtures,
  invitationFixtures,
} from "@mernmafia/shared/testing/accountSocialFixtures";
const onRespond = fn();
const onRead = fn();
const meta = {
  title: "Features/Notifications",
  component: NotificationsView,
  parameters: { nextjs: { appDirectory: true } },
  args: {
    items: notificationFixtures,
    invitations: invitationFixtures,
    onRead,
    onRespond,
  },
} satisfies Meta<typeof NotificationsView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Inbox: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Accept and join" }),
    );
    await expect(onRespond).toHaveBeenCalledWith(3, true);
    await userEvent.click(
      canvas.getByRole("button", { name: "Mark all read" }),
    );
    await expect(onRead).toHaveBeenCalled();
  },
};
export const Empty: Story = { args: { items: [], invitations: [] } };
export const Busy: Story = { args: { busy: true } };
