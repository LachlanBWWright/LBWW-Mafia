import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { PersistentLobbyDetail } from "./campaigns";
import { campaignFixture } from "@mernmafia/shared/game/campaignFixtures";
const meta = {
  title: "Features/Persistent lobbies",
  component: PersistentLobbyDetail,
  args: {
    lobby: campaignFixture,
    busy: false,
    onRotate: fn(),
    onRound: fn(),
    onVote: fn(),
  },
} satisfies Meta<typeof PersistentLobbyDetail>;
export default meta;
type Story = StoryObj<typeof meta>;
export const GameNight: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Current host: Sam")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Rotate host" }));
    await expect(args.onRotate).toHaveBeenCalled();
    await userEvent.type(canvas.getByLabelText("Completed match number"), "43");
    await userEvent.click(canvas.getByRole("button", { name: "Add round" }));
    await expect(args.onRound).toHaveBeenCalledWith(43);
  },
};
export const Member: Story = {
  args: { lobby: { ...campaignFixture, canManage: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole("button", { name: "Rotate host" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Vote for setup" }),
    ).toBeVisible();
  },
};
export const Empty: Story = {
  args: {
    lobby: { ...campaignFixture, rounds: [], scoreboard: [], votes: [] },
  },
};
export const Saving: Story = { args: { busy: true } };
