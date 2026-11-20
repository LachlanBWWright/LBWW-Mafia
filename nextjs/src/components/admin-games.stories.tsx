import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { AdminGameList, AdminGames } from "./admin-games";
import {
  adminGamesFixture,
  loadAdminGamesFixture,
  unavailableAdminGames,
} from "@mernmafia/shared/testing/adminGamesFixtures";
const meta = {
  title: "Features/Admin Games",
  component: AdminGameList,
  args: { page: adminGamesFixture },
} satisfies Meta<typeof AdminGameList>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Rooms: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("In progress")).toBeVisible();
    await userEvent.click(canvas.getByText("View players"));
    await expect(canvas.getByText("Theo")).toBeVisible();
    await expect(
      canvas.getByText("Match history awaiting save · 3 attempts"),
    ).toBeVisible();
    await expect(
      canvas.getByText("Room could not be reached. Refresh to retry."),
    ).toBeVisible();
  },
};
export const Empty: Story = {
  args: { page: { ...adminGamesFixture, games: [], nextOffset: null } },
};

export const Controls: Story = {
  render: () => <AdminGames loadGames={loadAdminGamesFixture} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Game night")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await expect(
      await canvas.findByRole("button", { name: "Previous" }),
    ).toBeEnabled();
    await userEvent.click(canvas.getByRole("button", { name: "Previous" }));
    await expect(await canvas.findByText("Game night")).toBeVisible();
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Room ID" }),
      "game-night",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Find room" }));
    await expect(
      await canvas.findByRole("button", { name: "All games" }),
    ).toBeVisible();
    await expect(canvas.queryByText("Quick join")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "All games" }));
    await expect(await canvas.findByText("Quick join")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Refresh" }));
    await expect(await canvas.findByText("Game night")).toBeVisible();
  },
};
export const Unavailable: Story = {
  render: () => <AdminGames loadGames={unavailableAdminGames} />,
};
