import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import CreateLobbyPage from "./page";
const meta = {
  title: "Features/Custom lobby",
  component: CreateLobbyPage,
  parameters: { nextjs: { appDirectory: true }, layout: "fullscreen" },
} satisfies Meta<typeof CreateLobbyPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const RolePool: Story = {};
export const ExplicitSlots: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Explicit slots" }),
    );
    await expect(canvas.getByLabelText("Role slots")).toBeVisible();
  },
};
export const InvalidRules: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Create lobby" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "Enable at least one role.",
    );
  },
};
