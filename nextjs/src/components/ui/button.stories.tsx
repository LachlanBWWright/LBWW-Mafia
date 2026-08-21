import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus } from "lucide-react";

import { Button } from "./button";

const meta = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Button" },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "destructive",
        "outline",
        "secondary",
        "ghost",
        "link",
      ],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Destructive: Story = { args: { variant: "destructive" } };
export const Outline: Story = { args: { variant: "outline" } };
export const Disabled: Story = { args: { disabled: true } };
export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Plus /> Create game
      </>
    ),
  },
};
