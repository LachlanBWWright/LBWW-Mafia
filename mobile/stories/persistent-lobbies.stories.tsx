import type { Meta, StoryObj } from "@storybook/react-native";
import { PersistentLobbyDetail } from "../screens/CampaignsScreen";
import { campaignFixture } from "../../shared/game/campaignFixtures";
const noop = () => undefined;
const meta = {
  title: "Features/Persistent lobbies",
  component: PersistentLobbyDetail,
  args: {
    lobby: campaignFixture,
    busy: false,
    onRotate: noop,
    onRound: noop,
    onVote: noop,
  },
} satisfies Meta<typeof PersistentLobbyDetail>;
export default meta;
type Story = StoryObj<typeof meta>;
export const GameNight: Story = {};
export const Member: Story = {
  args: { lobby: { ...campaignFixture, canManage: false } },
};
export const Empty: Story = {
  args: {
    lobby: { ...campaignFixture, rounds: [], scoreboard: [], votes: [] },
  },
};
export const Saving: Story = { args: { busy: true } };
