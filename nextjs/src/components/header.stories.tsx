import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { HeaderView } from "./header-view";

const meta = {
  title: "Features/Header",
  component: HeaderView,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof HeaderView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SignedOut: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("link", { name: "Sign in" }),
    ).toBeVisible();
  },
};
export const AuthenticatedAdmin: Story = {
  args: { user: { name: "Lachlan", handle: "nightowl", isAdmin: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "@nightowl" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Admin" })).toBeVisible();
  },
};
