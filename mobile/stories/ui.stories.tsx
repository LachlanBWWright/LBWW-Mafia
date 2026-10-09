import {
  AccountPrivacyStory as AccountPrivacyCapture,
  SavedPresetsStory as SavedPresetsCapture,
  PlayerStatisticsStory as PlayerStatisticsCapture,
} from "../components/AccountFeatureStories";
import { NotificationsView } from "../screens/NotificationsScreen";
import { PlayerReports } from "../components/PlayerReports";
import {
  notificationFixtures,
  invitationFixtures,
  reportFixtures,
} from "../../shared/testing/accountSocialFixtures";
import { AccountSecurity } from "../components/AccountSecurity";
import { CreateLobbyForm } from "../screens/CreateLobbyScreen";
import { MessageThread } from "../components/MessageThread";
import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-native";
import { Text, View } from "react-native";
import {
  Badge,
  Button,
  Card,
  Input,
  ListRow,
  SectionHeader,
} from "../components/ui";

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
        <Text className="text-3xl font-black text-foreground">
          LBWW <Text className="text-primary">Mafia</Text>
        </Text>
        <Text className="text-sm text-muted-foreground">
          Native design-system states.
        </Text>
      </View>
      <Card>
        <SectionHeader title="Buttons" />
        <View className="flex-row flex-wrap gap-2">
          <Button onPress={noop}>Primary</Button>
          <Button variant="secondary" onPress={noop}>
            Secondary
          </Button>
          <Button variant="outline" onPress={noop}>
            Outline
          </Button>
          <Button variant="destructive" onPress={noop}>
            Danger
          </Button>
          <Button disabled onPress={noop}>
            Disabled
          </Button>
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
        <SectionHeader
          title="Player rows"
          subtitle="Gameplay states use the same primitives."
        />
        <ListRow
          title="Mira (You)"
          subtitle="Role: Investigator"
          tone="success"
          trailing={<Badge variant="primary">Ready</Badge>}
        />
        <ListRow
          title="Theo"
          subtitle="Role hidden"
          tone="muted"
          trailing={<Badge variant="outline">Waiting</Badge>}
        />
        <ListRow
          title="Jules"
          subtitle="Eliminated on day 2"
          tone="danger"
          trailing={<Badge variant="destructive">Dead</Badge>}
        />
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
      <SectionHeader
        title="Button Playground"
        subtitle="Use on-device controls to test variants"
      />
      <View className="items-center py-4">
        <Button {...args}>{args.children}</Button>
      </View>
    </Card>
  ),
};

export const ButtonSecondary: StoryObj<typeof Button> = {
  name: "Button Secondary",
  args: { children: "Secondary action", variant: "secondary" },
  render: (args) => <Button {...args}>{args.children}</Button>,
};

export const ButtonOutline: StoryObj<typeof Button> = {
  name: "Button Outline",
  args: { children: "Outline action", variant: "outline" },
  render: (args) => <Button {...args}>{args.children}</Button>,
};

export const ButtonDestructive: StoryObj<typeof Button> = {
  name: "Button Destructive",
  args: { children: "Delete game", variant: "destructive" },
  render: (args) => <Button {...args}>{args.children}</Button>,
};

export const ButtonGhost: StoryObj<typeof Button> = {
  name: "Button Ghost",
  args: { children: "More options", variant: "ghost" },
  render: (args) => <Button {...args}>{args.children}</Button>,
};

export const ButtonDisabled: StoryObj<typeof Button> = {
  name: "Button Disabled",
  args: { children: "Unavailable", disabled: true },
  render: (args) => <Button {...args}>{args.children}</Button>,
};

export const ButtonSmall: StoryObj<typeof Button> = {
  name: "Button Small",
  args: { children: "Compact", size: "sm" },
  render: (args) => <Button {...args}>{args.children}</Button>,
};

export const ButtonLarge: StoryObj<typeof Button> = {
  name: "Button Large",
  args: { children: "Primary action", size: "lg" },
  render: (args) => <Button {...args}>{args.children}</Button>,
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
      <SectionHeader
        title="Badge Playground"
        subtitle="Test status indicators"
      />
      <View className="items-center py-4">
        <Badge {...args}>{args.children}</Badge>
      </View>
    </Card>
  ),
};

export const BadgeSecondary: StoryObj<typeof Badge> = {
  name: "Badge Secondary",
  args: { children: "Waiting", variant: "secondary" },
  render: (args) => <Badge {...args}>{args.children}</Badge>,
};

export const BadgeDestructive: StoryObj<typeof Badge> = {
  name: "Badge Destructive",
  args: { children: "Eliminated", variant: "destructive" },
  render: (args) => <Badge {...args}>{args.children}</Badge>,
};

export const BadgeOutline: StoryObj<typeof Badge> = {
  name: "Badge Outline",
  args: { children: "Spectating", variant: "outline" },
  render: (args) => <Badge {...args}>{args.children}</Badge>,
};

export const CustomLobby: Story = {
  render: () => (
    <CreateLobbyForm initialPresets={[]} onCreate={async () => undefined} />
  ),
};
export const MessageHistory: Story = {
  render: () => (
    <MessageThread
      reportUserId="mira"
      messages={[
        {
          id: 1,
          conversationId: 1,
          senderId: "mira",
          senderName: "Mira",
          body: "Ready for the next game?",
          createdAt: new Date("2026-10-03T00:00:00Z"),
        },
      ]}
      hasOlder
      loadingOlder={false}
      sending={false}
      draft=""
      onOlder={() => undefined}
      onDraft={() => undefined}
      onSend={() => undefined}
    />
  ),
};

export const AccountSecurityStory: Story = {
  render: () => (
    <AccountSecurity
      initialSessions={[
        {
          id: "phone",
          deviceName: "iPhone",
          createdAt: new Date("2026-10-04"),
        },
      ]}
    />
  ),
};

export const NotificationsStory: Story = {
  render: () => (
    <NotificationsView
      items={notificationFixtures}
      invitations={invitationFixtures}
      onRead={() => undefined}
      onRespond={() => undefined}
      onOpen={() => undefined}
    />
  ),
};
export const NotificationsEmpty: Story = {
  render: () => (
    <NotificationsView
      items={[]}
      invitations={[]}
      onRead={() => undefined}
      onRespond={() => undefined}
      onOpen={() => undefined}
    />
  ),
};
export const ReportOutcomes: Story = {
  render: () => <PlayerReports initialReports={reportFixtures} />,
};
export const ReportModeration: Story = {
  render: () => <PlayerReports initialReports={reportFixtures} moderation />,
};

export const AccountPrivacyStory: Story = {
  render: () => <AccountPrivacyCapture />,
};
export const SavedPresetsStory: Story = {
  render: () => <SavedPresetsCapture />,
};
export const PlayerStatisticsStory: Story = {
  render: () => <PlayerStatisticsCapture />,
};
