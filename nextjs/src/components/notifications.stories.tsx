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
  beforeEach: () => {
    const original = globalThis.fetch;
    globalThis.fetch = (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.includes("/api/lobbies/friday-mafia/info"))
        return Promise.resolve(
          Response.json({
            roomId: "friday-mafia",
            name: "Friday game",
            hostName: "Mira",
            visibility: "public",
            players: 3,
            capacity: 8,
            status: "waiting",
          }),
        );
      return original(input, init);
    };
    return () => {
      globalThis.fetch = original;
    };
  },
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
    await userEvent.click(canvas.getByRole("button", { name: "Join" }));
    await expect(onRespond).toHaveBeenCalledWith(3, true);
    await userEvent.click(
      canvas.getByRole("button", { name: "Mark all read" }),
    );
    await expect(onRead).toHaveBeenCalled();
  },
};
export const Empty: Story = { args: { items: [], invitations: [] } };
export const Busy: Story = { args: { busy: true } };
