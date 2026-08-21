import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Input } from "./input";

const meta = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  args: { placeholder: "Player name" },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithValue: Story = { args: { defaultValue: "Godfather" } };
export const Disabled: Story = { args: { disabled: true } };
export const Invalid: Story = {
  args: { "aria-invalid": true, defaultValue: "Taken name" },
};
