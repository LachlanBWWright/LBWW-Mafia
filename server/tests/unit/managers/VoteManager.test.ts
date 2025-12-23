import { describe, it, expect, beforeEach } from "vitest";
import { VoteManager } from "../../model/managers/VoteManager.js";

describe("VoteManager", () => {
  let voteManager: VoteManager;

  beforeEach(() => {
    voteManager = new VoteManager();
  });

  describe("Vote Casting", () => {
    it("should cast a vote", () => {
      voteManager.castVote("player1", "target1");
      expect(voteManager.hasVoted("player1")).toBe(true);
    });

    it("should return vote target", () => {
      voteManager.castVote("player1", "target1");
      expect(voteManager.getVoteByPlayer("player1")).toBe("target1");
    });

    it("should allow changing vote", () => {
      voteManager.castVote("player1", "target1");
      voteManager.castVote("player1", "target2");
      expect(voteManager.getVoteByPlayer("player1")).toBe("target2");
    });

    it("should remove a vote", () => {
      voteManager.castVote("player1", "target1");
      voteManager.removeVote("player1");
      expect(voteManager.hasVoted("player1")).toBe(false);
    });
  });

  describe("Vote Counting", () => {
    it("should count votes for a target", () => {
      voteManager.castVote("player1", "target1");
      voteManager.castVote("player2", "target1");
      voteManager.castVote("player3", "target2");

      expect(voteManager.getVotesForTarget("target1")).toBe(2);
      expect(voteManager.getVotesForTarget("target2")).toBe(1);
    });

    it("should identify vote leader", () => {
      voteManager.castVote("player1", "target1");
      voteManager.castVote("player2", "target1");
      voteManager.castVote("player3", "target2");

      expect(voteManager.getLeader()).toBe("target1");
    });

    it("should return null when no votes", () => {
      expect(voteManager.getLeader()).toBe(null);
    });
  });

  describe("Majority Detection", () => {
    it("should detect majority with 5 players", () => {
      voteManager.castVote("p1", "target");
      voteManager.castVote("p2", "target");
      voteManager.castVote("p3", "target");

      expect(voteManager.hasReachedMajority(5)).toBe(true);
    });

    it("should not detect majority without enough votes", () => {
      voteManager.castVote("p1", "target");
      voteManager.castVote("p2", "target");

      expect(voteManager.hasReachedMajority(5)).toBe(false);
    });

    it("should calculate required votes correctly", () => {
      expect(voteManager.getRequiredVotes(5)).toBe(3);
      expect(voteManager.getRequiredVotes(7)).toBe(4);
      expect(voteManager.getRequiredVotes(10)).toBe(6);
    });
  });

  describe("Vote Distribution", () => {
    it("should return vote distribution", () => {
      voteManager.castVote("p1", "target1");
      voteManager.castVote("p2", "target1");
      voteManager.castVote("p3", "target2");

      const distribution = voteManager.getVoteDistribution();

      expect(distribution.target1.count).toBe(2);
      expect(distribution.target1.voters).toContain("p1");
      expect(distribution.target1.voters).toContain("p2");
      expect(distribution.target2.count).toBe(1);
      expect(distribution.target2.voters).toContain("p3");
    });
  });

  describe("Vote Management", () => {
    it("should get all voters", () => {
      voteManager.castVote("p1", "target1");
      voteManager.castVote("p2", "target1");
      voteManager.castVote("p3", "target2");

      const voters = voteManager.getVoters();
      expect(voters).toHaveLength(3);
      expect(voters).toContain("p1");
      expect(voters).toContain("p2");
      expect(voters).toContain("p3");
    });

    it("should get total vote count", () => {
      voteManager.castVote("p1", "target1");
      voteManager.castVote("p2", "target1");
      voteManager.castVote("p3", "target2");

      expect(voteManager.getTotalVotes()).toBe(3);
    });

    it("should reset all votes", () => {
      voteManager.castVote("p1", "target1");
      voteManager.castVote("p2", "target1");

      voteManager.reset();

      expect(voteManager.getTotalVotes()).toBe(0);
      expect(voteManager.hasVoted("p1")).toBe(false);
    });
  });
});
