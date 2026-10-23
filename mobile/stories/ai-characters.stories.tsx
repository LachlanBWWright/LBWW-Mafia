import { chatGPTFixture } from "../../shared/testing/chatGPTFixtures";
import type { Meta, StoryObj } from "@storybook/react-native";
import {
  AiCharactersPanel,
  AiCharactersSetup,
} from "../components/AiCharactersPanel";

const meta = {
  title: "Features/AI Characters",
  component: AiCharactersPanel,
  args: { roomId: "fixture-room", connectionClient: chatGPTFixture() },
} satisfies Meta<typeof AiCharactersPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Setup: Story = {};

export const WaitingRoomControl: Story = {
  render: () => (
    <AiCharactersSetup
      roomId="fixture-room"
      connectionClient={chatGPTFixture()}
    />
  ),
};
export const Open: Story = {
  render: () => (
    <AiCharactersSetup
      roomId="fixture-room"
      initialOpen
      connectionClient={chatGPTFixture()}
    />
  ),
};

export const Connected: Story = {
  args: { connectionClient: chatGPTFixture("connected") },
};
export const UsageLimit: Story = {
  args: { connectionClient: chatGPTFixture("usage-limit") },
};
export const PlanDisabled: Story = {
  args: { connectionClient: chatGPTFixture("plan-disabled") },
};
