import { describe, it, expect, beforeEach } from "vitest";
import {
  WinConditionManager,
  FactionEliminationWinCondition,
  PeacemakerWinCondition,
  MaxDaysWinCondition,
  type WinConditionContext,
} from "../../model/managers/WinConditionManager.js";
import { Player } from "../../model/player/player.js";
import type { Role } from "../../model/roles/abstractRole.js";
import { RoleGroup } from "../../../shared/roles/roleEnums.js";

describe("WinConditionManager", () => {
  let manager: WinConditionManager;

  beforeEach(() => {
    manager = new WinConditionManager();
  });

  describe("Condition Registration", () => {
    it("should register win conditions", () => {
      const condition = new FactionEliminationWinCondition();
      manager.registerCondition(condition);

      expect(manager.getConditions()).toHaveLength(1);
    });

    it("should sort conditions by priority", () => {
      const condition1 = new FactionEliminationWinCondition(); // Priority 50
      const condition2 = new PeacemakerWinCondition(); // Priority 100

      manager.registerCondition(condition1);
      manager.registerCondition(condition2);

      const conditions = manager.getConditions();
      expect(conditions[0]).toBeInstanceOf(PeacemakerWinCondition);
      expect(conditions[1]).toBeInstanceOf(FactionEliminationWinCondition);
    });

    it("should clear all conditions", () => {
      manager.registerCondition(new FactionEliminationWinCondition());
      manager.clearConditions();

      expect(manager.getConditions()).toHaveLength(0);
    });
  });

  describe("FactionEliminationWinCondition", () => {
    let condition: FactionEliminationWinCondition;
    let context: WinConditionContext;

    beforeEach(() => {
      condition = new FactionEliminationWinCondition();
      context = {
        alivePlayers: [],
        allPlayers: [],
        dayNumber: 1,
        endDay: 10,
        confesserVotedOut: false,
      };
    });

    it("should return null when multiple factions alive", () => {
      const player1 = new Player("s1", "p1", 0);
      const player2 = new Player("s2", "p2", 1);

      // Mock roles with different groups
      player1.role = { group: RoleGroup.Town } as unknown as Role;
      player2.role = { group: RoleGroup.Mafia } as unknown as Role;

      context.alivePlayers = [player1, player2];

      const result = condition.check(context);
      expect(result).toBe(null);
    });

    it("should detect town victory", () => {
      const player1 = new Player("s1", "p1", 0);
      const player2 = new Player("s2", "p2", 1);

      player1.role = { group: RoleGroup.Town } as unknown as Role;
      player2.role = { group: RoleGroup.Town } as unknown as Role;

      context.alivePlayers = [player1, player2];

      const result = condition.check(context);
      expect(result).not.toBe(null);
      expect(result!.winningFaction).toBe(RoleGroup.Town);
    });

    it("should detect mafia victory", () => {
      const player1 = new Player("s1", "p1", 0);

      player1.role = { group: RoleGroup.Mafia } as unknown as Role;

      context.alivePlayers = [player1];

      const result = condition.check(context);
      expect(result).not.toBe(null);
      expect(result!.winningFaction).toBe(RoleGroup.Mafia);
    });

    it("should include neutral players in winners", () => {
      const player1 = new Player("s1", "p1", 0);
      const player2 = new Player("s2", "p2", 1);

      player1.role = { group: RoleGroup.Town } as unknown as Role;
      player2.role = { group: RoleGroup.Neutral } as unknown as Role;

      context.alivePlayers = [player1, player2];

      const result = condition.check(context);
      expect(result).not.toBe(null);
      expect(result!.winningPlayers).toHaveLength(2);
    });
  });

  describe("PeacemakerWinCondition", () => {
    let condition: PeacemakerWinCondition;
    let context: WinConditionContext;

    beforeEach(() => {
      condition = new PeacemakerWinCondition();
      context = {
        alivePlayers: [],
        allPlayers: [],
        dayNumber: 10,
        endDay: 10,
        confesserVotedOut: false,
      };
    });

    it("should detect peacemaker win", () => {
      const peacemaker = { player: new Player("s1", "p1", 0) } as unknown as {
        player: Player;
      };
      context.peacemaker = peacemaker;

      const result = condition.check(context);
      expect(result).not.toBe(null);
      expect(result!.winningFaction).toBe("nobody");
      expect(result!.specialWins?.peacemaker).toBe(true);
    });

    it("should return null if day < endDay", () => {
      context.dayNumber = 5;
      context.endDay = 10;
      context.peacemaker = { player: new Player("s1", "p1", 0) } as unknown as {
        player: Player;
      };

      const result = condition.check(context);
      expect(result).toBe(null);
    });

    it("should return null if no peacemaker", () => {
      context.peacemaker = null;

      const result = condition.check(context);
      expect(result).toBe(null);
    });
  });

  describe("MaxDaysWinCondition", () => {
    let condition: MaxDaysWinCondition;
    let context: WinConditionContext;

    beforeEach(() => {
      condition = new MaxDaysWinCondition(10);
      context = {
        alivePlayers: [],
        allPlayers: [],
        dayNumber: 10,
        endDay: 10,
        confesserVotedOut: false,
      };
    });

    it("should detect max days reached", () => {
      const result = condition.check(context);
      expect(result).not.toBe(null);
      expect(result!.winningFaction).toBe("nobody");
    });

    it("should return null if max days not reached", () => {
      context.dayNumber = 5;

      const result = condition.check(context);
      expect(result).toBe(null);
    });
  });

  describe("Check Win Conditions", () => {
    it("should check conditions in priority order", () => {
      const context: WinConditionContext = {
        alivePlayers: [],
        allPlayers: [],
        dayNumber: 10,
        endDay: 10,
        confesserVotedOut: false,
        peacemaker: { player: new Player("s1", "p1", 0) } as unknown as {
          player: Player;
        },
      };

      manager.registerCondition(new FactionEliminationWinCondition());
      manager.registerCondition(new PeacemakerWinCondition());
      manager.registerCondition(new MaxDaysWinCondition(10));

      const result = manager.checkWinConditions(context);

      // Peacemaker has highest priority, should win
      expect(result).not.toBe(null);
      expect(result!.specialWins?.peacemaker).toBe(true);
    });

    it("should return null if no conditions met", () => {
      const player1 = new Player("s1", "p1", 0);
      const player2 = new Player("s2", "p2", 1);

      player1.role = { group: RoleGroup.Town } as unknown as Role;
      player2.role = { group: RoleGroup.Mafia } as unknown as Role;

      const context: WinConditionContext = {
        alivePlayers: [player1, player2],
        allPlayers: [player1, player2],
        dayNumber: 1,
        endDay: 10,
        confesserVotedOut: false,
      };

      manager.registerCondition(new FactionEliminationWinCondition());

      const result = manager.checkWinConditions(context);
      expect(result).toBe(null);
    });
  });
});
