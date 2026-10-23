import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { LobbyPresets } from "./lobby-presets";
import { fixtureLobbyPreset } from "@mernmafia/shared/testing/accountFixtures";
const meta = {
  title: "Features/Lobby presets",
  component: LobbyPresets,
  args: {
    initialPresets: [fixtureLobbyPreset],
    getConfig: () => fixtureLobbyPreset.config,
    onApply: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LobbyPresets>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Saved: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Load" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Classic trio loaded.",
    );
  },
};
