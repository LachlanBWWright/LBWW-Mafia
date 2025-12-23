import { describe, it, expect, beforeEach } from "vitest";
import {
  GameStateManager,
  type GameState,
} from "../../model/managers/GameStateManager.js";
import { Time } from "../../../../shared/socketTypes/socketTypes.js";

describe("GameStateManager", () => {
  let stateManager: GameStateManager;

  beforeEach(() => {
    stateManager = new GameStateManager();
  });

  describe("Phase Management", () => {
    it("should start with Between phase", () => {
      expect(stateManager.getCurrentPhase()).toBe(Time.Between);
    });

    it("should change phase", () => {
      stateManager.setCurrentPhase(Time.Day);
      expect(stateManager.getCurrentPhase()).toBe(Time.Day);
    });

    it("should notify listeners on phase change", () => {
      let notified = false;
      stateManager.subscribe(() => {
        notified = true;
      });

      stateManager.setCurrentPhase(Time.Day);
      expect(notified).toBe(true);
    });
  });

  describe("Day Management", () => {
    it("should start at day 0", () => {
      expect(stateManager.getDayNumber()).toBe(0);
    });

    it("should increment day number", () => {
      stateManager.incrementDayNumber();
      expect(stateManager.getDayNumber()).toBe(1);
    });

    it("should set day number", () => {
      stateManager.setDayNumber(5);
      expect(stateManager.getDayNumber()).toBe(5);
    });
  });

  describe("Game State", () => {
    it("should start as not started", () => {
      expect(stateManager.hasStarted()).toBe(false);
    });

    it("should mark game as started", () => {
      stateManager.setStarted(true);
      expect(stateManager.hasStarted()).toBe(true);
    });

    it("should start as not ended", () => {
      expect(stateManager.hasEnded()).toBe(false);
    });

    it("should mark game as ended", () => {
      stateManager.setGameEnded(true);
      expect(stateManager.hasEnded()).toBe(true);
    });
  });

  describe("Snapshots", () => {
    it("should create snapshot", () => {
      stateManager.setCurrentPhase(Time.Day);
      stateManager.setDayNumber(3);
      stateManager.setStarted(true);

      const snapshot = stateManager.getSnapshot();
      expect(snapshot.currentPhase).toBe(Time.Day);
      expect(snapshot.dayNumber).toBe(3);
      expect(snapshot.started).toBe(true);
      expect(snapshot.timestamp).toBeGreaterThan(0);
    });

    it("should restore from snapshot", () => {
      const snapshot = stateManager.getSnapshot();
      snapshot.currentPhase = Time.Night;
      snapshot.dayNumber = 5;
      snapshot.started = true;

      stateManager.restoreSnapshot(snapshot);
      expect(stateManager.getCurrentPhase()).toBe(Time.Night);
      expect(stateManager.getDayNumber()).toBe(5);
      expect(stateManager.hasStarted()).toBe(true);
    });
  });

  describe("Observers", () => {
    it("should subscribe and unsubscribe listeners", () => {
      let callCount = 0;
      const listener = () => {
        callCount++;
      };

      stateManager.subscribe(listener);
      stateManager.setCurrentPhase(Time.Day);
      expect(callCount).toBe(1);

      stateManager.unsubscribe(listener);
      stateManager.setCurrentPhase(Time.Night);
      expect(callCount).toBe(1); // Should not increase
    });

    it("should provide previous and current state to listeners", () => {
      let previousPhase: Time | null = null;
      let currentPhase: Time | null = null;

      stateManager.subscribe((current: GameState, previous: GameState) => {
        previousPhase = previous.currentPhase;
        currentPhase = current.currentPhase;
      });

      stateManager.setCurrentPhase(Time.Day);
      expect(previousPhase).toBe(Time.Between);
      expect(currentPhase).toBe(Time.Day);
    });
  });

  describe("Reset", () => {
    it("should reset to initial state", () => {
      stateManager.setCurrentPhase(Time.Day);
      stateManager.setDayNumber(5);
      stateManager.setStarted(true);
      stateManager.setGameEnded(true);

      stateManager.reset();

      expect(stateManager.getCurrentPhase()).toBe(Time.Between);
      expect(stateManager.getDayNumber()).toBe(0);
      expect(stateManager.hasStarted()).toBe(false);
      expect(stateManager.hasEnded()).toBe(false);
    });
  });
});
