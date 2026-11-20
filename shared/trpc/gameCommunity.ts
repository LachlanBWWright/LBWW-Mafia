import { z } from "zod";
export const campaignInput = z.object({ campaignId: z.string().uuid() });
export const campaignCreateInput = z.object({
  name: z.string().trim().min(1).max(80),
});
export const campaignJoinInput = z.object({
  shareCode: z.string().regex(/^[a-f0-9]{32}$/),
});
export const campaignRoundInput = campaignInput.extend({
  matchId: z.number().int().positive(),
});
export const campaignVoteInput = campaignInput.extend({
  packCode: z.string().min(1).max(300000),
});
export const discussionInput = z.object({
  matchId: z.number().int().positive(),
});
export const annotationInput = discussionInput.extend({
  eventIndex: z.number().int().min(0).max(100000),
  text: z.string().trim().min(1).max(1000),
});
export const deleteAnnotationInput = discussionInput.extend({
  annotationId: z.string().uuid(),
});
export const nominationInput = discussionInput.extend({
  nomineeId: z.string().min(1).max(255),
  eventIndex: z.number().int().min(0).max(100000),
});
export type CampaignSummary = {
  canManage: boolean;
  id: string;
  name: string;
  ownerId: string;
  hostId: string;
  shareCode: string;
  members: { userId: string; name: string | null }[];
  rounds: { matchId: number }[];
  votes: { userId: string; packCode: string }[];
  scoreboard: {
    userId: string;
    name: string | null;
    wins: number;
    draws: number;
    games: number;
  }[];
};
export type MatchDiscussion = {
  viewerId: string;
  participants: { userId: string; name: string }[];
  annotations: {
    id: string;
    authorId: string;
    authorName: string | null;
    eventIndex: number;
    text: string;
  }[];
  nominations: { userId: string; nomineeId: string; eventIndex: number }[];
};
export type GameCommunityServices = {
  list(userId: string): Promise<CampaignSummary[]>;
  create(
    userId: string,
    input: z.infer<typeof campaignCreateInput>,
  ): Promise<CampaignSummary>;
  join(
    userId: string,
    input: z.infer<typeof campaignJoinInput>,
  ): Promise<CampaignSummary>;
  detail(
    userId: string,
    input: z.infer<typeof campaignInput>,
  ): Promise<CampaignSummary>;
  rotateHost(
    userId: string,
    input: z.infer<typeof campaignInput>,
  ): Promise<CampaignSummary>;
  addRound(
    userId: string,
    input: z.infer<typeof campaignRoundInput>,
  ): Promise<CampaignSummary>;
  voteSetup(
    userId: string,
    input: z.infer<typeof campaignVoteInput>,
  ): Promise<CampaignSummary>;
  discussion(
    userId: string,
    input: z.infer<typeof discussionInput>,
  ): Promise<MatchDiscussion>;
  annotate(
    userId: string,
    input: z.infer<typeof annotationInput>,
  ): Promise<void>;
  deleteAnnotation(
    userId: string,
    input: z.infer<typeof deleteAnnotationInput>,
  ): Promise<void>;
  nominate(
    userId: string,
    input: z.infer<typeof nominationInput>,
  ): Promise<void>;
};
