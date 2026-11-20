import type { CampaignSummary } from "../trpc/gameCommunity";
import type { MatchReplay } from "../trpc/matchAnalysis";

export function campaignHost(campaign: CampaignSummary) {
  return (
    campaign.members.find((member) => member.userId === campaign.hostId)
      ?.name ?? "Unnamed player"
  );
}
export function setupVoteCounts(campaign: CampaignSummary) {
  const counts = new Map<string, number>();
  for (const vote of campaign.votes)
    counts.set(vote.packCode, (counts.get(vote.packCode) ?? 0) + 1);
  return [...counts]
    .map(([packCode, votes]) => ({ packCode, votes }))
    .sort((a, b) => b.votes - a.votes);
}
/** Discussion indices must never include private whispers. */
export function publicDiscussionEvents(replay: MatchReplay) {
  return replay.events
    .filter((event) => event.type !== "whisper")
    .sort((a, b) => a.time - b.time);
}
export function campaignFailure(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to update the persistent lobby. Please try again.";
}
