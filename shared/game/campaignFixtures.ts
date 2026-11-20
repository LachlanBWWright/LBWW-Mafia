import type { CampaignSummary } from "../trpc/gameCommunity";
export const campaignFixture: CampaignSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Friday night",
  ownerId: "alex",
  hostId: "sam",
  canManage: true,
  shareCode: "0123456789abcdef0123456789abcdef",
  members: [
    { userId: "alex", name: "Alex" },
    { userId: "sam", name: "Sam" },
  ],
  rounds: [{ matchId: 42 }],
  votes: [
    { userId: "alex", packCode: "classic-night" },
    { userId: "sam", packCode: "classic-night" },
  ],
  scoreboard: [
    { userId: "alex", name: "Alex", games: 1, wins: 1, draws: 0 },
    { userId: "sam", name: "Sam", games: 1, wins: 0, draws: 0 },
  ],
};
