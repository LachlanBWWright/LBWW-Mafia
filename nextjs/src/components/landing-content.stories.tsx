import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { LandingContent } from "./landing-content";

const meta = {
  title: "Screens/Home",
  component: LandingContent,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <main className="bg-background text-foreground mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
        <Story />
      </main>
    ),
  ],
} satisfies Meta<typeof LandingContent>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Landing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Example discussion" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Join Game" }),
    ).toHaveAttribute("href", "/lobby");
    await expect(
      canvas.getByRole("link", { name: "Create Lobby" }),
    ).toHaveAttribute("href", "/lobby/create");
    await expect(canvas.getByText("Mira voted for Theo.")).toBeVisible();
  },
};
