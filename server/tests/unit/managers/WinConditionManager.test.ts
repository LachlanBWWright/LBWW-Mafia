import { describe, it, expect, beforeEach } from "vitest";
import {
  WinConditionManager,
  MaxDaysWinCondition,
  FactionEliminationWinCondition,
  PeacemakerWinCondition,
  type WinConditionContext,
} from "../../../model/managers/WinConditionManager.js";
import { Player } from "../../../model/player/player.js";
import { RoleGroup } from "../../../../shared/roles/roleEnums.js";
import type { Role } from "../../../model/roles/abstractRole.js";
import type { Peacemaker } from "../../../model/roles/neutral/peacemaker.js";

// Minimal mock role to avoid complex dependencies
class MockRole implements Role {
  readonly name = "MockRole";
  group: RoleGroup;
  constructor(group: RoleGroup) {
    this.group = group;
  }
  get description() { return ""; }
  get winConditionDescription() { return ""; }
}

describe("WinConditionManager", () => {
  let winManager: WinConditionManager;

  beforeEach(() => {
    winManager = new WinConditionManager();
  });

  it("should register and check MaxDaysWinCondition", () => {
    const condition = new MaxDaysWinCondition(5);
    winManager.registerCondition(condition);

    const context: WinConditionContext = {
      dayNumber: 3,
      alivePlayers: [],
      allPlayers: [],
      endDay: 10,
      confesserVotedOut: false,
    };

    expect(winManager.checkWinConditions(context)).toBeNull();

    context.dayNumber = 5;
    expect(winManager.checkWinConditions(context)).not.toBeNull();
  });

  it("should register and check FactionEliminationWinCondition", () => {
    const condition = new FactionEliminationWinCondition();
    winManager.registerCondition(condition);

    const p1 = new Player("1", "p1", RoleGroup.Town);
    p1.role = new MockRole(RoleGroup.Town);

    const p2 = new Player("2", "p2", RoleGroup.Mafia);
    p2.role = new MockRole(RoleGroup.Mafia);

    const context: WinConditionContext = {
      dayNumber: 1,
      alivePlayers: [p1, p2],
      allPlayers: [p1, p2],
      endDay: 10,
      confesserVotedOut: false,
    };

    // Both factions alive
    expect(winManager.checkWinConditions(context)).toBeNull();

    // Eliminate Mafia
    context.alivePlayers = [p1];
    const result = winManager.checkWinConditions(context);
    expect(result).not.toBeNull();
    expect(result?.winningFaction).toBe(RoleGroup.Town);
  });

  it("should register and check PeacemakerWinCondition", () => {
    const condition = new PeacemakerWinCondition();
    winManager.registerCondition(condition);

    const pmPlayer = new Player("pm", "Peacemaker", RoleGroup.Neutral);
    const mockPeacemakerRole = {
       player: pmPlayer
    } as unknown as Peacemaker;

    const context: WinConditionContext = {
      dayNumber: 5,
      alivePlayers: [pmPlayer],
      allPlayers: [pmPlayer],
      endDay: 6, // Not reached yet
      confesserVotedOut: false,
      peacemaker: mockPeacemakerRole
    };

    expect(winManager.checkWinConditions(context)).toBeNull();

    // Reached endDay
    context.dayNumber = 6;
    const result = winManager.checkWinConditions(context);
    expect(result).not.toBeNull();
    expect(result?.winningFaction).toBe("nobody");
    expect(result?.specialWins?.peacemaker).toBe(true);
  });
});
