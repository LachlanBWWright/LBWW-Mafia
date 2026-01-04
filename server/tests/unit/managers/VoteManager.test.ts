import { describe, it, expect, beforeEach } from "vitest";
import { VoteManager } from "../../../model/managers/VoteManager.js";

describe("VoteManager", () => {
  let voteManager: VoteManager;

  beforeEach(() => {
    voteManager = new VoteManager();
  });

  it("should register votes", () => {
    voteManager.castVote("voter1", "target1");
    expect(voteManager.getVoteByPlayer("voter1")).toBe("target1");
  });

  it("should count votes correctly", () => {
    voteManager.castVote("voter1", "target1");
    voteManager.castVote("voter2", "target1");
    voteManager.castVote("voter3", "target2");

    expect(voteManager.getVotesForTarget("target1")).toBe(2);
    expect(voteManager.getVotesForTarget("target2")).toBe(1);
  });

  it("should clear votes", () => {
    voteManager.castVote("voter1", "target1");
    voteManager.reset();
    expect(voteManager.getVoteByPlayer("voter1")).toBeNull();
    expect(voteManager.getTotalVotes()).toBe(0);
  });
});
