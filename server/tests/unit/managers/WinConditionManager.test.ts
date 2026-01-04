import { describe, it, expect, beforeEach } from "vitest";
import {
  WinConditionManager,
  MaxDaysWinCondition,
  type WinConditionContext,
} from "../../../model/managers/WinConditionManager.js";
import { Player } from "../../../model/player/player.js";
import type { Role } from "../../../model/roles/abstractRole.js";
import { Time } from "../../../../shared/socketTypes/socketTypes.js";

describe("WinConditionManager", () => {
  let winManager: WinConditionManager;

  beforeEach(() => {
    winManager = new WinConditionManager();
  });

  it("should register and check win conditions", () => {
    const condition = new MaxDaysWinCondition(5);
    winManager.registerCondition(condition);

    const context: WinConditionContext = {
        dayNumber: 3,
        alivePlayers: [],
        allPlayers: [],
        endDay: 10,
        confesserVotedOut: false
    };

    expect(winManager.checkWinConditions(context)).toBeNull();

    context.dayNumber = 5;
    expect(winManager.checkWinConditions(context)).not.toBeNull();
  });
});
