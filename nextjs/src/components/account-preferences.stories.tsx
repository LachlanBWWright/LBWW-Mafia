import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AccountPreferences } from "./account-preferences";
import { fixtureFeaturePreferences } from "@mernmafia/shared/testing/accountFixtures";
const meta = {
  title: "Features/Account privacy",
  component: AccountPreferences,
  args: {
    initialPreferences: fixtureFeaturePreferences,
    initialBlocked: [
      { id: "blocked", name: "Muted player", handle: "muted_player" },
    ],
    onDeleted: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountPreferences>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Privacy: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const remove = canvas.getByRole("button", { name: "Delete account" });
    await expect(remove).toBeDisabled();
    const confirmation = canvas.getByLabelText(
      "Type DELETE to delete your account",
    );
    await userEvent.type(confirmation, "delete");
    await expect(remove).toBeDisabled();
    await userEvent.clear(confirmation);
    await userEvent.type(confirmation, "DELETE");
    await expect(remove).toBeEnabled();
  },
};
