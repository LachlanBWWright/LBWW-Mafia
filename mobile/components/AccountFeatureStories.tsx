import React from "react";
import { AccountPreferences } from "./AccountPreferences";
import { LobbyPresets } from "./LobbyPresets";
import { PlayerInsights } from "./PlayerInsights";
import {
  fixtureFeaturePreferences,
  fixtureLobbyPreset,
  fixtureAchievements,
  fixtureDetailedStats,
} from "../../shared/testing/accountFixtures";
import { fixtureProfile } from "../../shared/testing/fixtures";
export function AccountPrivacyStory() {
  return (
    <AccountPreferences
      initialPreferences={fixtureFeaturePreferences}
      initialBlocked={[
        { id: "blocked", name: "Muted player", handle: "muted_player" },
      ]}
      onDeleted={() => undefined}
    />
  );
}
export function SavedPresetsStory() {
  return (
    <LobbyPresets
      initialPresets={[fixtureLobbyPreset]}
      getConfig={() => fixtureLobbyPreset.config}
      onApply={() => undefined}
    />
  );
}
export function PlayerStatisticsStory() {
  return (
    <PlayerInsights
      initialProfile={{ ...fixtureProfile, avatarPreset: "fox" }}
      initialStats={fixtureDetailedStats}
      initialAchievements={fixtureAchievements}
    />
  );
}
