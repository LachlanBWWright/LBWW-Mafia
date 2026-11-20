import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { RoleSandbox } from "./role-sandbox";
const meta = {
  title: "Features/Role sandbox",
  component: RoleSandbox,
} satisfies Meta<typeof RoleSandbox>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Scenario: Story = {
  args: {
    run: async () => ({
      nights: [
        {
          night: 1,
          accepted: true,
          targetDamage: 0,
          targetDefence: 1,
          targetBlocked: false,
          redirectedToActor: false,
          notices: ["Target protected."],
        },
        {
          night: 2,
          accepted: false,
          targetDamage: 0,
          targetDefence: 0,
          targetBlocked: false,
          redirectedToActor: false,
          notices: ["Cannot repeat target."],
        },
        {
          night: 3,
          accepted: true,
          targetDamage: 0,
          targetDefence: 1,
          targetBlocked: false,
          redirectedToActor: false,
          notices: [],
        },
      ],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Run scenario" }));
    await expect(
      await canvas.findByText("Night 2: Action rejected"),
    ).toBeVisible();
  },
};
export const Unavailable: Story = {
  args: {
    run: async () => {
      throw new Error("Sandbox unavailable. Please try again.");
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Run scenario" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Sandbox unavailable",
    );
  },
};
