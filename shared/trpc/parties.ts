import { z } from "zod";

export const MAX_PARTY_MEMBERS = 15;
export const PARTY_INVITATION_TTL_MS = 30 * 60 * 1000;
export const partyUserInputSchema = z.object({
  userId: z.string().min(1).max(255),
});
export const partyInviteInputSchema = z.object({
  recipientId: z.string().min(1).max(255),
});
export const partyRespondInputSchema = z.object({
  id: z.number().int().positive(),
  accept: z.boolean(),
});
export const partyMoveInputSchema = z.object({
  roomId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
});

export type PartyMember = {
  userId: string;
  name: string | null;
  handle: string | null;
  joinedAt: Date;
};
export type PartySummary = {
  id: string;
  leaderId: string;
  roomId: string | null;
  updatedAt: Date;
  members: PartyMember[];
};
export type PartyInvitation = {
  id: number;
  partyId: string;
  senderId: string;
  senderName: string | null;
  expiresAt: Date;
};
export type PartyServices = {
  current(userId: string): Promise<PartySummary | null>;
  invitations(userId: string): Promise<PartyInvitation[]>;
  create(userId: string): Promise<PartySummary>;
  invite(
    userId: string,
    input: z.infer<typeof partyInviteInputSchema>,
  ): Promise<PartyInvitation>;
  respond(
    userId: string,
    input: z.infer<typeof partyRespondInputSchema>,
  ): Promise<PartySummary | null>;
  leave(userId: string): Promise<void>;
  kick(
    userId: string,
    input: z.infer<typeof partyUserInputSchema>,
  ): Promise<void>;
  transfer(
    userId: string,
    input: z.infer<typeof partyUserInputSchema>,
  ): Promise<void>;
  move(
    userId: string,
    input: z.infer<typeof partyMoveInputSchema>,
  ): Promise<void>;
};
