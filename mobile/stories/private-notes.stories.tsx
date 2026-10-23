import type { Meta, StoryObj } from "@storybook/react-native";
import { PrivateNotesPanel } from "../components/PrivateNotesPanel";
const meta = {
  title: "Features/Private Notes",
  component: PrivateNotesPanel,
  args: {
    lobby: {
      matchId: "notes-story",
      playerName: "Alice",
      players: [{ name: "Alice" }, { name: "Bob" }],
    },
  },
} satisfies Meta<typeof PrivateNotesPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Match: Story = {};
export const Waiting: Story = {
  args: { lobby: { playerName: "Alice", players: [] } },
};
