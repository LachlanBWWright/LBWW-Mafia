import assert from "node:assert/strict";
import test from "node:test";
import {
  canPerformVisit,
  defaultVisitCapability,
  shouldShowDayOnlyActions,
  shouldShowVisitAction,
} from "./playerActionRules";

test("day-only actions hidden at night", () => {
  assert.equal(shouldShowDayOnlyActions("Night"), false);
  assert.equal(shouldShowDayOnlyActions("Day"), true);
});

test("visit action hidden if role has no visit capabilities for current phase", () => {
  assert.equal(shouldShowVisitAction("Day", defaultVisitCapability), false);
  assert.equal(
    shouldShowVisitAction("Night", {
      ...defaultVisitCapability,
      nightVisitOthers: true,
    }),
    true,
  );
});

test("visit respects same-faction restrictions", () => {
  const capability = {
    ...defaultVisitCapability,
    dayVisitOthers: true,
    dayVisitFaction: false,
  };

  const canVisitFactionMate = canPerformVisit({
    time: "Day",
    isSelf: false,
    targetAlive: true,
    actorAlive: true,
    actorRole: "Mafia",
    targetRole: "Mafia Investigator",
    capability,
  });
  const canVisitOtherFaction = canPerformVisit({
    time: "Day",
    isSelf: false,
    targetAlive: true,
    actorAlive: true,
    actorRole: "Mafia",
    targetRole: "Doctor",
    capability,
  });

  assert.equal(canVisitFactionMate, false);
  assert.equal(canVisitOtherFaction, true);
});

test("visit respects self-visit capability", () => {
  const withoutSelfVisit = canPerformVisit({
    time: "Day",
    isSelf: true,
    targetAlive: true,
    actorAlive: true,
    actorRole: "Doctor",
    targetRole: "Doctor",
    capability: {
      ...defaultVisitCapability,
      dayVisitOthers: true,
      dayVisitSelf: false,
    },
  });

  const withSelfVisit = canPerformVisit({
    time: "Day",
    isSelf: true,
    targetAlive: true,
    actorAlive: true,
    actorRole: "Doctor",
    targetRole: "Doctor",
    capability: {
      ...defaultVisitCapability,
      dayVisitOthers: true,
      dayVisitSelf: true,
    },
  });

  assert.equal(withoutSelfVisit, false);
  assert.equal(withSelfVisit, true);
});
