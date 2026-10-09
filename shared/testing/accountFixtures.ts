import { fixtureStats } from "./fixtures";
import type {
  FeaturePreferences,
  LobbyPreset,
  PlayerAchievement,
} from "../trpc/accountFeatures";
import { lobbyConfigSchema } from "../game/lobbyConfig";
export const fixtureFeaturePreferences: FeaturePreferences = {
  messagePermission: "friends",
  invitePermission: "friends",
  hidePresence: false,
  avatarPreset: "fox",
  notificationFriendRequests: true,
  notificationMessages: true,
  notificationInvites: true,
};
export const fixtureLobbyPreset: LobbyPreset = {
  id: 1,
  name: "Classic trio",
  updatedAt: new Date("2026-10-06"),
  config: lobbyConfigSchema.parse({
    size: 3,
    roleSelection: {
      algorithm: "explicit-slots",
      explicitSlots: ["doctor", "doctor", "mafia"],
    },
  }),
};
export const fixtureAchievements: PlayerAchievement[] = [
  {
    id: "first-win",
    name: "First victory",
    description: "Win your first game.",
    unlocked: true,
    progress: 1,
    target: 1,
  },
  {
    id: "ten-games",
    name: "Regular player",
    description: "Play ten games.",
    unlocked: false,
    progress: 4,
    target: 10,
  },
];

export const fixtureDetailedStats = {
  ...fixtureStats,
  recentResults: [true, false, true, true],
  recentWinRate: 0.75,
  roles: [
    { role: "Doctor", games: 80, wins: 60 },
    { role: "Mafia", games: 48, wins: 22 },
  ],
  factions: [
    { faction: "town", games: 80, wins: 60 },
    { faction: "mafia", games: 48, wins: 22 },
  ],
};
