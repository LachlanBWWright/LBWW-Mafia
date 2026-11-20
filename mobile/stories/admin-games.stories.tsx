import type { Meta, StoryObj } from "@storybook/react-native";
import { AdminGameList, AdminGames } from "../components/AdminGames";
import {
  adminGamesFixture,
  loadAdminGamesFixture,
  unavailableAdminGames,
} from "../../shared/testing/adminGamesFixtures";
const meta = {
  title: "Features/Admin Games",
  component: AdminGameList,
  args: { page: adminGamesFixture },
} satisfies Meta<typeof AdminGameList>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Rooms: Story = {};
export const Empty: Story = {
  args: { page: { ...adminGamesFixture, games: [], nextOffset: null } },
};

export const Controls: Story = {
  render: () => <AdminGames loadGames={loadAdminGamesFixture} />,
};
export const Unavailable: Story = {
  render: () => <AdminGames loadGames={unavailableAdminGames} />,
};
