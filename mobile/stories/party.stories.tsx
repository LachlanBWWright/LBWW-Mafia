import type { Meta, StoryObj } from "@storybook/react-native";
import { LobbyGroupView } from "../components/LobbyGroupPanel";
import { fixtureUsers } from "../../shared/testing/fixtures";
import {
  fixtureParty,
  fixturePartyInvitation,
} from "../../shared/testing/partyFixtures";
const meta = {
  title: "Features/Party",
  component: LobbyGroupView,
  args: {
    party: fixtureParty,
    invitations: [],
    friends: fixtureUsers.filter((user) => user.relationship === "friend"),
    userId: "user-mira",
    roomId: "next-round",
    onAction: () => undefined,
    onFollowRoom: () => undefined,
    onShareLobby: () => undefined,
    onRefresh: () => undefined,
  },
} satisfies Meta<typeof LobbyGroupView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Leader: Story = {};
export const Member: Story = { args: { userId: "user-theo" } };
export const Invitation: Story = {
  args: {
    party: null,
    invitations: [fixturePartyInvitation],
    userId: "user-nadia",
  },
};
export const Empty: Story = {
  args: { party: null, invitations: [], friends: [] },
};
export const ConnectionError: Story = {
  args: { party: null, error: "Unable to load your party. Please try again." },
};
