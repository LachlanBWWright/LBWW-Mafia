import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { MessageThread } from "./message-thread";
const meta = {
  title: "Features/Message thread",
  component: MessageThread,
  decorators: [
    (Story) => (
      <div className="flex w-full max-w-xl flex-col gap-3">
        <Story />
      </div>
    ),
  ],
  args: {
    messages: [
      {
        id: 1,
        conversationId: 1,
        senderId: "mira",
        senderName: "Mira",
        body: "Ready for the next game?",
        createdAt: new Date("2026-10-03T00:00:00Z"),
      },
    ],
    hasOlder: true,
    sending: false,
    draft: "",
    onDraft: fn(),
    onSend: fn(),
    onOlder: fn(),
  },
} satisfies Meta<typeof MessageThread>;
export default meta;
type Story = StoryObj<typeof meta>;
export const History: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Load older messages" }),
    );
    await expect(args.onOlder).toHaveBeenCalled();
    await expect(canvas.getByRole("button", { name: "Send" })).toBeDisabled();
  },
};
export const Sending: Story = { args: { draft: "Yes!", sending: true } };
