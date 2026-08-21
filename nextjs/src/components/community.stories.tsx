import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { CommunityView } from "./community";

const onAction = fn();
const meta = {
  title: "Features/Community",
  component: CommunityView,
  args: {
    query: "",
    onQueryChange: fn(),
    onSearch: fn(),
    onAction,
    users: [
      {
        id: "1",
        name: "Mira",
        handle: "mira",
        image: null,
        relationship: "none",
      },
      {
        id: "2",
        name: "Theo",
        handle: "theo",
        image: null,
        relationship: "incoming",
      },
      {
        id: "3",
        name: "Nadia",
        handle: "nadia",
        image: null,
        relationship: "friend",
      },
      {
        id: "4",
        name: "Blocked player",
        handle: null,
        image: null,
        relationship: "blocked",
      },
    ],
  },
} satisfies Meta<typeof CommunityView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const RelationshipStates: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Add friend" }));
    await expect(onAction).toHaveBeenCalled();
    await expect(canvas.getByRole("button", { name: "Accept" })).toBeVisible();
  },
};
export const Empty: Story = { args: { users: [] } };
