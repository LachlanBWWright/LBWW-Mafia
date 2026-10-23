import { describe, expect, it } from "vitest";
import {
  filterReplayEvents,
  matchOutcome,
  replayEventLabel,
} from "./replayPresentation";
import type { MatchHistoryEvent } from "../trpc/validators";
const events: MatchHistoryEvent[] = [
  { type: "system", time: 1, content: "Day begins" },
  { type: "chat", time: 2, actor: "Sam", content: "My claim" },
  {
    type: "whisper",
    time: 3,
    actor: "Sam",
    target: "Alex",
    content: "A private claim",
  },
  {
    type: "action",
    kind: "vote",
    time: 4,
    actor: "Alex",
    target: "Sam",
    content: "Voted",
  },
];
describe("replay presentation", () => {
  it("keeps conversations separate from the decisions timeline without reordering", () => {
    expect(
      filterReplayEvents(events, "conversation").map((event) => event.time),
    ).toEqual([2, 3]);
    expect(
      filterReplayEvents(events, "decisions").map((event) => event.time),
    ).toEqual([1, 4]);
    expect(filterReplayEvents(events, "all")).toEqual(events);
  });
  it("labels votes and phase metadata explicitly", () => {
    expect(replayEventLabel(events[3]!)).toBe("Alex → Sam · Vote");
    expect(
      replayEventLabel({
        type: "system",
        time: 1,
        kind: "death",
        phase: "Day",
        day: 2,
        content: "Eliminated",
      }),
    ).toBe("Elimination · Day 2");
  });
  it("shows a draw without claiming a faction won", () => {
    for (const value of ["", "None", "draw", "tie"])
      expect(matchOutcome(value)).toBe("Draw");
    expect(matchOutcome("Town")).toBe("Town won");
  });
});
