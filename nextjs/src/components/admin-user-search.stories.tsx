import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { AdminUserSearch } from "./admin-user-search";

const meta = {
  title: "Features/Admin User Search",
  component: AdminUserSearch,
  args: {
    initialQuery: "",
    initialUsers: [
      { id: "1", name: "Mira", email: "mira@example.com", isAdmin: false },
      { id: "2", name: "Theo", email: "theo@example.com", isAdmin: true },
    ],
  },
} satisfies Meta<typeof AdminUserSearch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Results: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("mira@example.com")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Revoke admin" }),
    ).toBeVisible();
  },
};
export const Initial: Story = { args: { initialUsers: [] } };
