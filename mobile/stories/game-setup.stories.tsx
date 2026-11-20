import type { Meta, StoryObj } from "@storybook/react-native";
import { MatchExperienceStory } from "../components/MatchExperienceStory";
import { customizedMatch } from "../../shared/testing/customizationFixtures";
const meta = {
  title: "Game/Setup",
  component: MatchExperienceStory,
  args: { lobby: customizedMatch },
} satisfies Meta<typeof MatchExperienceStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const HouseRules: Story = {};
