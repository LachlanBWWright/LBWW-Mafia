import landingMeta from "../stories/landing.stories";
import aiMeta, * as aiStories from "../stories/ai-characters.stories";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import spectatorMeta, * as spectatorStories from "../stories/spectators.stories";
import partyMeta, * as partyStories from "../stories/party.stories";
import { ScrollView, View } from "react-native";
import * as uiStories from "../stories/ui.stories";
import privateNotesMeta, * as privateNotesStories from "../stories/private-notes.stories";
import matchAnalysisMeta, * as matchAnalysisStories from "../stories/match-analysis.stories";

const stories = {
  "screens-home--landing": { render: landingMeta.component, args: landingMeta.args },
  "features-ai-characters--plan-disabled": {
    render: aiMeta.component,
    args: { ...aiMeta.args, ...aiStories.PlanDisabled.args },
  },
  "features-ai-characters--setup": {
    render: aiMeta.component,
    args: aiMeta.args,
  },
  "features-ai-characters--waiting-room-control": aiStories.WaitingRoomControl,
  "features-ai-characters--open": aiStories.Open,
  "features-ai-characters--connected": {
    render: aiMeta.component,
    args: { ...aiMeta.args, ...aiStories.Connected.args },
  },
  "features-ai-characters--usage-limit": {
    render: aiMeta.component,
    args: { ...aiMeta.args, ...aiStories.UsageLimit.args },
  },
  "features-spectators--watching": {
    render: spectatorMeta.component,
    args: { ...spectatorMeta.args, ...spectatorStories.Watching.args },
  },
  "features-spectators--eliminated": {
    render: spectatorMeta.component,
    args: { ...spectatorMeta.args, ...spectatorStories.Eliminated.args },
  },
  "features-party--leader": {
    render: partyMeta.component,
    args: { ...partyMeta.args, ...partyStories.Leader.args },
  },
  "features-party--member": {
    render: partyMeta.component,
    args: { ...partyMeta.args, ...partyStories.Member.args },
  },
  "features-party--invitation": {
    render: partyMeta.component,
    args: { ...partyMeta.args, ...partyStories.Invitation.args },
  },
  "features-party--empty": {
    render: partyMeta.component,
    args: { ...partyMeta.args, ...partyStories.Empty.args },
  },
  "features-party--connection-error": {
    render: partyMeta.component,
    args: { ...partyMeta.args, ...partyStories.ConnectionError.args },
  },
  "features-match-analysis--replay": {
    render: matchAnalysisMeta.component,
    args: { ...matchAnalysisMeta.args, ...matchAnalysisStories.Replay.args },
  },
  "features-match-analysis--empty-replay": {
    render: matchAnalysisMeta.component,
    args: {
      ...matchAnalysisMeta.args,
      ...matchAnalysisStories.EmptyReplay.args,
    },
  },
  "features-match-analysis--balance": matchAnalysisStories.Balance,
  "features-match-analysis--empty-balance": matchAnalysisStories.EmptyBalance,
  "features-private-notes--match": {
    render: privateNotesMeta.component,
    args: { ...privateNotesMeta.args, ...privateNotesStories.Match.args },
  },
  "features-private-notes--waiting": {
    render: privateNotesMeta.component,
    args: { ...privateNotesMeta.args, ...privateNotesStories.Waiting.args },
  },
  "mobile-ui-kit--match-practice": uiStories.MatchPractice,
  "mobile-ui-kit--match-night": uiStories.MatchNight,
  "mobile-ui-kit--match-voting": uiStories.MatchVoting,
  "mobile-ui-kit--match-hidden-votes": uiStories.MatchHiddenVotes,
  "mobile-ui-kit--match-recap": uiStories.MatchRecap,
  "mobile-ui-kit--match-reconnecting": uiStories.MatchReconnecting,
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
    <SafeAreaProvider>
      {storyId.startsWith("mobile-ui-kit--match-") ? (
        <View className="flex-1 bg-background p-4">
          <Render {...((story.args ?? {}) as Record<string, unknown>)} />
        </View>
      ) : <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 16 }}
      >
        <Render {...((story.args ?? {}) as Record<string, unknown>)} />
      </ScrollView>}
    </SafeAreaProvider>
  );
}
