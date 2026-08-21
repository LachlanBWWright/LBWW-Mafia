import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-native";
import { Text, View } from "react-native";
import { Badge, Button, Card, Input, ListRow, SectionHeader } from "../components/ui";

const meta = {
  title: "Mobile/UI kit",
  decorators: [
    (Story) => (
      <View className="w-full max-w-xl gap-4 self-center">
        <Story />
      </View>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Gallery() {
  const [name, setName] = useState("The Godfather");
  const noop = () => undefined;

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text className="text-3xl font-black text-foreground">LBWW <Text className="text-primary">Mafia</Text></Text>
        <Text className="text-sm text-muted-foreground">Native design-system states.</Text>
      </View>
      <Card>
        <SectionHeader title="Buttons" />
        <View className="flex-row flex-wrap gap-2">
          <Button onPress={noop}>Primary</Button>
          <Button variant="secondary" onPress={noop}>Secondary</Button>
          <Button variant="outline" onPress={noop}>Outline</Button>
          <Button variant="destructive" onPress={noop}>Danger</Button>
          <Button disabled onPress={noop}>Disabled</Button>
        </View>
      </Card>
      <Card>
        <SectionHeader title="Status and forms" />
        <View className="flex-row flex-wrap gap-2">
          <Badge variant="primary">Alive</Badge>
          <Badge variant="secondary">Waiting</Badge>
          <Badge variant="destructive">Eliminated</Badge>
          <Badge variant="outline">Spectating</Badge>
        </View>
        <Input value={name} onChangeText={setName} placeholder="Display name" />
      </Card>
      <Card>
        <SectionHeader title="Player rows" subtitle="Gameplay states use the same primitives." />
        <ListRow title="Mira (You)" subtitle="Role: Investigator" tone="success" trailing={<Badge variant="primary">Ready</Badge>} />
        <ListRow title="Theo" subtitle="Role hidden" tone="muted" trailing={<Badge variant="outline">Waiting</Badge>} />
        <ListRow title="Jules" subtitle="Eliminated on day 2" tone="danger" trailing={<Badge variant="destructive">Dead</Badge>} />
      </Card>
    </View>
  );
}

export const ComponentGallery: Story = { render: () => <Gallery /> };

export const ButtonStory: StoryObj<typeof Button> = {
  name: "Button Controls",
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["primary", "secondary", "outline", "destructive", "ghost"],
    },
    size: {
      control: { type: "select" },
      options: ["sm", "md", "lg"],
    },
    disabled: {
      control: { type: "boolean" },
    },
  },
  args: {
    children: "Action Button",
    variant: "primary",
    size: "md",
    disabled: false,
    onPress: () => undefined,
  },
  render: (args) => (
    <Card>
      <SectionHeader title="Button Playground" subtitle="Use on-device controls to test variants" />
      <View className="items-center py-4">
        <Button {...args}>{args.children}</Button>
      </View>
    </Card>
  ),
};

export const BadgeStory: StoryObj<typeof Badge> = {
  name: "Badge Controls",
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["primary", "secondary", "outline", "destructive"],
    },
  },
  args: {
    children: "Player Status",
    variant: "primary",
  },
  render: (args) => (
    <Card>
      <SectionHeader title="Badge Playground" subtitle="Test status indicators" />
      <View className="items-center py-4">
        <Badge {...args}>{args.children}</Badge>
      </View>
    </Card>
  ),
};

