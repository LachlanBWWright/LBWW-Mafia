import { z } from "zod";
import { lobbyConfigSchema, type LobbyConfig } from "../game/lobbyConfig";
export const avatarPresets = [
  "detective",
  "mafia",
  "doctor",
  "moon",
  "fox",
  "owl",
] as const;
export const avatarOptions = [
  { id: "detective", name: "Detective", symbol: "🕵️" },
  { id: "mafia", name: "Mafia", symbol: "🎩" },
  { id: "doctor", name: "Doctor", symbol: "🩺" },
  { id: "moon", name: "Moon", symbol: "🌙" },
  { id: "fox", name: "Fox", symbol: "🦊" },
  { id: "owl", name: "Owl", symbol: "🦉" },
] as const;
export const featurePreferencesSchema = z.object({
  messagePermission: z.enum(["friends", "nobody"]),
  invitePermission: z.enum(["friends", "nobody"]),
  hidePresence: z.boolean(),
  avatarPreset: z.enum(avatarPresets).nullable(),
  notificationFriendRequests: z.boolean(),
  notificationMessages: z.boolean(),
  notificationInvites: z.boolean(),
});
export type FeaturePreferences = z.infer<typeof featurePreferencesSchema>;
export const savePresetSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(60),
  config: lobbyConfigSchema,
});
export const createReportSchema = z.object({
  subjectId: z.string().min(1).max(255),
  reason: z.enum(["harassment", "cheating", "spam", "other"]),
  details: z
    .string()
    .trim()
    .min(10, "Describe what happened in at least 10 characters.")
    .max(2000),
  matchId: z.number().int().positive().optional(),
  messageId: z.number().int().positive().optional(),
});
export const reviewReportSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(["reviewing", "resolved", "dismissed"]),
  resolution: z.string().trim().max(1000).default(""),
});
export type AccountNotification = {
  id: number;
  category: "friend_request" | "message" | "lobby_invite";
  actorId: string | null;
  actorName: string | null;
  roomId: string | null;
  invitationId: number | null;
  readAt: Date | null;
  createdAt: Date;
};
export type LobbyInvitation = {
  id: number;
  senderId: string;
  senderName: string | null;
  recipientId: string;
  roomId: string;
  status: string;
  createdAt: Date;
  expiresAt: Date;
};
export type LobbyPreset = {
  id: number;
  name: string;
  config: LobbyConfig;
  updatedAt: Date;
};
export type PlayerAchievement = {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  progress: number;
  target: number;
};
export type PlayerReport = {
  id: number;
  reporterId: string;
  subjectId: string;
  reason: string;
  details: string;
  matchId: number | null;
  messageId: number | null;
  status: string;
  resolution: string | null;
  createdAt: Date;
};
export type AccountFeatureServices = {
  inbox(userId: string): Promise<AccountNotification[]>;
  markRead(userId: string, id?: number): Promise<void>;
  preferences(userId: string): Promise<FeaturePreferences>;
  updatePreferences(
    userId: string,
    input: FeaturePreferences,
  ): Promise<FeaturePreferences>;
  hostedLobbies(userId: string): Promise<{ roomId: string; createdAt: Date }[]>;
  invitations(userId: string): Promise<LobbyInvitation[]>;
  invite(
    userId: string,
    input: { recipientId: string; roomId: string },
  ): Promise<LobbyInvitation>;
  respondInvitation(
    userId: string,
    input: { id: number; accept: boolean },
  ): Promise<{ roomId: string | null }>;
  presets(userId: string): Promise<LobbyPreset[]>;
  savePreset(
    userId: string,
    input: z.infer<typeof savePresetSchema>,
  ): Promise<LobbyPreset>;
  deletePreset(userId: string, id: number): Promise<void>;
  blocked(
    userId: string,
  ): Promise<{ id: string; name: string | null; handle: string | null }[]>;
  unblock(userId: string, id: string): Promise<void>;
  achievements(userId: string): Promise<PlayerAchievement[]>;
  report(
    userId: string,
    input: z.infer<typeof createReportSchema>,
  ): Promise<{ id: number }>;
  reports(userId: string, isAdmin: boolean): Promise<PlayerReport[]>;
  reviewReport(
    userId: string,
    input: z.infer<typeof reviewReportSchema>,
  ): Promise<void>;
  exportData(userId: string): Promise<Record<string, unknown>>;
  deleteAccount(userId: string, confirmation: "DELETE"): Promise<void>;
};
