import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

const meta = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Card {...args} className="w-96">
      <CardHeader>
        <CardTitle>Night falls</CardTitle>
        <CardDescription>
          Choose your action before the timer expires.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">Three players are still available to target.</p>
      </CardContent>
      <CardFooter>
        <Button>Choose target</Button>
      </CardFooter>
    </Card>
  ),
};
