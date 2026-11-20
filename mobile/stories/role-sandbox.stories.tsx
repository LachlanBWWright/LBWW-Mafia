import type { Meta, StoryObj } from "@storybook/react-native";
import { RoleSandboxContent } from "../screens/RoleSandboxScreen";
const meta = {
  title: "Features/Role sandbox",
  component: RoleSandboxContent,
} satisfies Meta<typeof RoleSandboxContent>;
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
};
export const Unavailable: Story = {
  args: {
    run: async () => {
      throw new Error("Sandbox unavailable. Please try again.");
    },
  },
};
export const Rejected: Story = {
  args: {
    run: async () => ({
      nights: [1, 2, 3].map((night) => ({
        night,
        accepted: false,
        targetDamage: 0,
        targetDefence: 0,
        targetBlocked: false,
        redirectedToActor: false,
        notices: ["No ability charges remaining."],
      })),
    }),
  },
};
