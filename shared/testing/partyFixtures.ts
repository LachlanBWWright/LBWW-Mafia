import type { PartySummary, PartyInvitation } from "../trpc/parties";
export const fixtureParty: PartySummary = {
  id: "party-friday",
  leaderId: "user-mira",
  roomId: "friday-night",
  updatedAt: new Date("2026-01-01T12:00:00Z"),
  members: [
    {
      userId: "user-mira",
      name: "Mira",
      handle: "mira",
      joinedAt: new Date("2026-01-01T12:00:00Z"),
    },
    {
      userId: "user-theo",
      name: "Theo",
      handle: "theo",
      joinedAt: new Date("2026-01-01T12:01:00Z"),
    },
  ],
};
export const fixturePartyInvitation: PartyInvitation = {
  id: 42,
  partyId: "party-friday",
  senderId: "user-mira",
  senderName: "Mira",
  expiresAt: new Date("2099-01-01T12:30:00Z"),
};
