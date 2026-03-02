import { describe, it, expect } from "vitest";
import {
  canPerformVisit,
  canVoteTarget,
  canWhisperTarget,
  defaultVisitCapability,
  shouldShowDayOnlyActions,
  shouldShowVisitAction,
} from "./playerActionRules";

describe("playerActionRules", () => {
  it("day-only actions hidden at night", () => {
    expect(shouldShowDayOnlyActions("Night")).toBe(false);
    expect(shouldShowDayOnlyActions("Day")).toBe(true);
  });

  it("visit action hidden if role has no visit capabilities for current phase", () => {
    expect(shouldShowVisitAction("Day", defaultVisitCapability)).toBe(false);
    expect(shouldShowVisitAction("Night", { ...defaultVisitCapability, nightVisitOthers: true })).toBe(true);
  });

  it("visit respects same-faction restrictions", () => {
    const capability = { ...defaultVisitCapability, dayVisitOthers: true, dayVisitFaction: false };
    const canVisitFactionMate = canPerformVisit({
      time: "Day", isSelf: false, targetAlive: true, actorAlive: true,
      actorRole: "Mafia", targetRole: "Mafia Investigator", capability,
    });
    const canVisitOtherFaction = canPerformVisit({
      time: "Day", isSelf: false, targetAlive: true, actorAlive: true,
      actorRole: "Mafia", targetRole: "Doctor", capability,
    });
    expect(canVisitFactionMate).toBe(false);
    expect(canVisitOtherFaction).toBe(true);
  });

  it("visit respects self-visit capability", () => {
    const withoutSelfVisit = canPerformVisit({
      time: "Day", isSelf: true, targetAlive: true, actorAlive: true,
      actorRole: "Doctor", targetRole: "Doctor",
      capability: { ...defaultVisitCapability, dayVisitOthers: true, dayVisitSelf: false },
    });
    const withSelfVisit = canPerformVisit({
      time: "Day", isSelf: true, targetAlive: true, actorAlive: true,
      actorRole: "Doctor", targetRole: "Doctor",
      capability: { ...defaultVisitCapability, dayVisitOthers: true, dayVisitSelf: true },
    });
    expect(withoutSelfVisit).toBe(false);
    expect(withSelfVisit).toBe(true);
  });

  it("voting is day-only and disallows self/invalid targets", () => {
    expect(canVoteTarget({ time: "Night", actorAlive: true, targetAlive: true, isSelf: false, canVote: true })).toBe(false);
    expect(canVoteTarget({ time: "Day", actorAlive: true, targetAlive: true, isSelf: false, canVote: true })).toBe(true);
    expect(canVoteTarget({ time: "Day", actorAlive: true, targetAlive: true, isSelf: true, canVote: true })).toBe(false);
  });

  it("whispering requires day, target, and draft message", () => {
    expect(canWhisperTarget({ time: "Night", targetAlive: true, isSelf: false, hasMessage: true })).toBe(false);
    expect(canWhisperTarget({ time: "Day", targetAlive: true, isSelf: false, hasMessage: true })).toBe(true);
    expect(canWhisperTarget({ time: "Day", targetAlive: true, isSelf: false, hasMessage: false })).toBe(false);
  });
});
