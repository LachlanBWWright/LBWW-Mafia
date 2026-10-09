import React from "react";
import { ScrollView } from "react-native";
import * as uiStories from "../stories/ui.stories";

const stories = {
  "mobile-ui-kit--account-privacy": uiStories.AccountPrivacyStory,
  "mobile-ui-kit--saved-presets": uiStories.SavedPresetsStory,
  "mobile-ui-kit--player-statistics": uiStories.PlayerStatisticsStory,
  "mobile-ui-kit--notifications": uiStories.NotificationsStory,
  "mobile-ui-kit--notifications-empty": uiStories.NotificationsEmpty,
  "mobile-ui-kit--report-outcomes": uiStories.ReportOutcomes,
  "mobile-ui-kit--report-moderation": uiStories.ReportModeration,
  "mobile-ui-kit--account-security": uiStories.AccountSecurityStory,
  "mobile-ui-kit--custom-lobby": uiStories.CustomLobby,
  "mobile-ui-kit--message-history": uiStories.MessageHistory,
  "mobile-ui-kit--component-gallery": uiStories.ComponentGallery,
  "mobile-ui-kit--button-controls": uiStories.ButtonStory,
  "mobile-ui-kit--button-secondary": uiStories.ButtonSecondary,
  "mobile-ui-kit--button-outline": uiStories.ButtonOutline,
  "mobile-ui-kit--button-destructive": uiStories.ButtonDestructive,
  "mobile-ui-kit--button-ghost": uiStories.ButtonGhost,
  "mobile-ui-kit--button-disabled": uiStories.ButtonDisabled,
  "mobile-ui-kit--button-small": uiStories.ButtonSmall,
  "mobile-ui-kit--button-large": uiStories.ButtonLarge,
  "mobile-ui-kit--badge-controls": uiStories.BadgeStory,
  "mobile-ui-kit--badge-secondary": uiStories.BadgeSecondary,
  "mobile-ui-kit--badge-destructive": uiStories.BadgeDestructive,
  "mobile-ui-kit--badge-outline": uiStories.BadgeOutline,
} as const;

type StoryId = keyof typeof stories;

export function StoryCapture({ storyId }: { storyId: string }) {
  const story = stories[storyId as StoryId] ?? uiStories.ComponentGallery;
  const Render = story.render as unknown as React.ComponentType<
    Record<string, unknown>
  >;

  if (!Render) return null;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16 }}
    >
      <Render {...((story.args ?? {}) as Record<string, unknown>)} />
    </ScrollView>
  );
}
