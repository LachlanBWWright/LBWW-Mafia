import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PrivateNotesPanel } from "./PrivateNotesPanel";
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
  decorators: [
    (Story) => (
      <div className="max-w-lg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PrivateNotesPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Match: Story = {};
export const Waiting: Story = {
  args: { lobby: { playerName: "Alice", players: [] } },
};
