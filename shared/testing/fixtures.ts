import type { AccountProfile, PlayerStats } from "../trpc/appRouter";

/** Stable UI fixtures shared by web and mobile stories/tests. */
export const fixtureUsers = [
  { id: "user-mira", name: "Mira", handle: "mira", image: null, isOnline: true, relationship: "none" as const },
  { id: "user-theo", name: "Theo", handle: "theo", image: null, isOnline: false, relationship: "incoming" as const },
  { id: "user-nadia", name: "Nadia", handle: "nadia", image: null, isOnline: true, relationship: "friend" as const },
];

export const fixtureProfile = {
  id: "user-night-owl",
  name: "Night Owl",
  handle: "nightowl",
  email: "owl@example.com",
  image: null,
  bio: "Town investigator.",
  profileVisibility: "public",
  historyVisibility: "friends",
  theme: "dark",
  reducedMotion: false,
  soundEnabled: true,
  notificationsEnabled: true,
  roles: ["player"],
} satisfies AccountProfile;

export const fixtureStats = {
  gamesPlayed: 128,
  wins: 82,
  losses: 46,
  winRate: 0.64,
  currentStreak: 3,
  bestWinStreak: 9,
  roles: [],
  factions: [],
} satisfies PlayerStats;
