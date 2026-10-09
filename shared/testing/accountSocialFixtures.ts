import type {
  AccountNotification,
  LobbyInvitation,
  PlayerReport,
} from "../trpc/accountFeatures";
export const notificationFixtures: AccountNotification[] = [
  {
    id: 1,
    category: "friend_request",
    actorId: "mira",
    actorName: "Mira",
    roomId: null,
    invitationId: null,
    readAt: null,
    createdAt: new Date("2026-10-07T09:00:00Z"),
  },
  {
    id: 2,
    category: "message",
    actorId: "jules",
    actorName: "Jules",
    roomId: null,
    invitationId: null,
    readAt: new Date("2026-10-07T09:00:00Z"),
    createdAt: new Date("2026-10-07T08:00:00Z"),
  },
];
export const invitationFixtures: LobbyInvitation[] = [
  {
    id: 3,
    senderId: "mira",
    senderName: "Mira",
    recipientId: "player",
    roomId: "friday-mafia",
    status: "pending",
    createdAt: new Date("2026-10-07T09:00:00Z"),
    expiresAt: new Date("2026-10-07T09:30:00Z"),
  },
];
export const reportFixtures: PlayerReport[] = [
  {
    id: 1,
    reporterId: "player",
    subjectId: "jules",
    reason: "harassment",
    details: "Repeated abusive messages after being asked to stop.",
    matchId: 12,
    messageId: null,
    status: "reviewing",
    resolution: null,
    createdAt: new Date("2026-10-07T09:00:00Z"),
  },
  {
    id: 2,
    reporterId: "player",
    subjectId: "mira",
    reason: "spam",
    details: "Repeated unsolicited messages in the same conversation.",
    matchId: null,
    messageId: 5,
    status: "resolved",
    resolution: "The reported behaviour has been reviewed.",
    createdAt: new Date("2026-10-06T09:00:00Z"),
  },
];
