import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Separator } from "./separator";

const meta = {
  title: "UI/Separator",
  component: Separator,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="h-24 w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {};
export const Vertical: Story = { args: { orientation: "vertical" } };
