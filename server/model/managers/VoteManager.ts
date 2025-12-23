/**
 * Vote distribution showing how many votes each target has received
 */
export type VoteDistribution = Record<
  string,
  { count: number; voters: string[] }
>;

/**
 * Vote manager for handling day/night voting with majority detection
 *
 * Responsibilities:
 * - Vote tracking (day votes, night faction votes)
 * - Majority detection
 * - Vote removal (when players die)
 */
export class VoteManager {
  private votes = new Map<string, string>();

  /**
   * Cast a vote from one player to another
   * @param voterId ID of the player casting the vote
   * @param targetId ID of the player being voted for
   */
  castVote(voterId: string, targetId: string): void {
    this.votes.set(voterId, targetId);
  }

  /**
   * Remove a vote from a player
   * @param voterId ID of the player whose vote should be removed
   */
  removeVote(voterId: string): void {
    this.votes.delete(voterId);
  }

  /**
   * Get the player with the most votes (leader)
   * @returns ID of the leading player or null if no votes
   */
  getLeader(): string | null {
    const counts = this.getVoteCounts();
    let maxVotes = 0;
    let leader: string | null = null;

    for (const [targetId, count] of counts.entries()) {
      if (count > maxVotes) {
        maxVotes = count;
        leader = targetId;
      }
    }

    return leader;
  }

  /**
   * Get the number of votes for the leading player
   */
  getLeaderVoteCount(): number {
    const counts = this.getVoteCounts();
    return Math.max(...counts.values(), 0);
  }

  /**
   * Check if majority has been reached
   * @param totalPlayers Total number of players who can vote
   * @returns True if majority reached
   */
  hasReachedMajority(totalPlayers: number): boolean {
    const required = Math.floor(totalPlayers / 2) + 1;
    return this.getLeaderVoteCount() >= required;
  }

  /**
   * Get the number of votes required for majority
   * @param totalPlayers Total number of players who can vote
   */
  getRequiredVotes(totalPlayers: number): number {
    return Math.floor(totalPlayers / 2) + 1;
  }

  /**
   * Get vote counts for each target
   */
  private getVoteCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const targetId of this.votes.values()) {
      counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
    }
    return counts;
  }

  /**
   * Get detailed vote distribution
   */
  getVoteDistribution(): VoteDistribution {
    const distribution: VoteDistribution = {};

    for (const [voterId, targetId] of this.votes.entries()) {
      distribution[targetId] ??= {
        count: 0,
        voters: [],
      };
      distribution[targetId].count++;
      distribution[targetId].voters.push(voterId);
    }

    return distribution;
  }

  /**
   * Get the number of votes a specific target has received
   */
  getVotesForTarget(targetId: string): number {
    const counts = this.getVoteCounts();
    return counts.get(targetId) ?? 0;
  }

  /**
   * Get all voters
   */
  getVoters(): string[] {
    return Array.from(this.votes.keys());
  }

  /**
   * Get who a specific player voted for
   */
  getVoteByPlayer(voterId: string): string | null {
    return this.votes.get(voterId) ?? null;
  }

  /**
   * Check if a player has voted
   */
  hasVoted(voterId: string): boolean {
    return this.votes.has(voterId);
  }

  /**
   * Reset all votes
   */
  reset(): void {
    this.votes.clear();
  }

  /**
   * Get total number of votes cast
   */
  getTotalVotes(): number {
    return this.votes.size;
  }
}
