import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { ReportPlayer } from "./report-player";
const meta = {
  title: "Features/Report player",
  component: ReportPlayer,
  args: { userId: "mira", name: "Mira", initialMessageId: 42 },
} satisfies Meta<typeof ReportPlayer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MessageContext: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^Report$/ }));
    const body = within(canvasElement.ownerDocument.body);
    await expect(
      body.getByRole("textbox", { name: "Message ID (optional)" }),
    ).toHaveValue("42");
    await userEvent.type(
      body.getByPlaceholderText("Describe what happened"),
      "Repeated abusive messages.",
    );
  },
};
