import type { Meta, StoryObj } from "@storybook/react-native";
import { LandingContent } from "../components/LandingContent";

const meta = {
  title: "Screens/Home",
  component: LandingContent,
  args: { onJoin: () => undefined, onCreate: () => undefined },
} satisfies Meta<typeof LandingContent>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Landing: Story = {};
