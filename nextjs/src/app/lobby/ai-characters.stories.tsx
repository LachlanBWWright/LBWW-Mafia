import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { chatGPTFixture } from "@mernmafia/shared/testing/chatGPTFixtures";
import { AiCharactersPanel } from "./AiCharactersPanel";

const meta = {
  title: "Features/AI Characters",
  component: AiCharactersPanel,
  args: { roomId: "fixture-room", connectionClient: chatGPTFixture() },
  decorators: [
    (Story) => (
      <div className="w-full max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AiCharactersPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Setup: Story = {};

export const BrowserUnavailable: Story = {
  args: { connectionClient: undefined },
};

export const Open: Story = { args: { initialOpen: true } };

export const Connected: Story = {
  args: { initialOpen: true, connectionClient: chatGPTFixture("connected") },
};
export const UsageLimit: Story = {
  args: { initialOpen: true, connectionClient: chatGPTFixture("usage-limit") },
};
export const PlanDisabled: Story = {
  args: {
    initialOpen: true,
    connectionClient: chatGPTFixture("plan-disabled"),
  },
};
