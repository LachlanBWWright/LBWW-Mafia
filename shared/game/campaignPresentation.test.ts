import { describe, it, expect } from "vitest";
import { campaignFixture } from "./campaignFixtures";
import { replayFixture } from "./matchAnalysisFixtures";
import {
  campaignHost,
  setupVoteCounts,
  publicDiscussionEvents,
  campaignFailure,
} from "./campaignPresentation";
describe("campaign presentation", () => {
  it("names the current host and safely handles removed members", () => {
    expect(campaignHost(campaignFixture)).toBe("Sam");
    expect(campaignHost({ ...campaignFixture, members: [] })).toBe(
      "Unnamed player",
    );
  });
  it("aggregates votes with deterministic descending totals", () => {
    expect(
      setupVoteCounts({
        ...campaignFixture,
        votes: [...campaignFixture.votes, { userId: "other", packCode: "new" }],
      }),
    ).toEqual([
      { packCode: "classic-night", votes: 2 },
      { packCode: "new", votes: 1 },
    ]);
  });
  it("excludes whispers and sorts public events without mutating replay", () => {
    const replay = {
      ...replayFixture,
      events: [...replayFixture.events].reverse(),
    };
    const before = [...replay.events];
    const events = publicDiscussionEvents(replay);
    expect(events.every((event) => event.type !== "whisper")).toBe(true);
    expect(events.map((event) => event.time)).toEqual(
      events.map((event) => event.time).sort((a, b) => a - b),
    );
    expect(replay.events).toEqual(before);
  });
  it("provides recoverable errors for unknown failures", () => {
    expect(campaignFailure(new Error("Invite expired"))).toBe("Invite expired");
    expect(campaignFailure(null)).toContain("try again");
  });
});
