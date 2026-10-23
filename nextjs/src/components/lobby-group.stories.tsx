import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { LobbyGroupView } from "./lobby-group";
import { fixtureUsers } from "@mernmafia/shared/testing/fixtures";
import {
  fixtureParty,
  fixturePartyInvitation,
} from "@mernmafia/shared/testing/partyFixtures";
const onAction = fn();
const onFollowRoom = fn();
const meta = {
  title: "Features/Party",
  component: LobbyGroupView,
  args: {
    party: fixtureParty,
    invitations: [],
    friends: fixtureUsers.filter((user) => user.relationship === "friend"),
    userId: "user-mira",
    roomId: "next-round",
    onAction,
    onFollowRoom,
    onShareLobby: fn(),
    onRefresh: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LobbyGroupView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Leader: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Invite to party" }),
    );
    await expect(onAction).toHaveBeenCalledWith({
      type: "invite",
      recipientId: "user-nadia",
    });
    await userEvent.click(
      canvas.getByRole("button", {
        name: "Set this lobby as party destination",
      }),
    );
    await expect(onAction).toHaveBeenCalledWith({
      type: "move",
      roomId: "next-round",
    });
  },
};
export const Member: Story = {
  args: { userId: "user-theo" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole("button", { name: "Set party lobby" }),
    ).toBeNull();
    await userEvent.click(
      canvas.getByRole("button", { name: "Join party lobby" }),
    );
    await expect(onFollowRoom).toHaveBeenCalledWith("friday-night");
  },
};
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
