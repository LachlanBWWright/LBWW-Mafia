import { describe, it, expect, beforeEach } from "vitest";
import {
  GameStateManager,
} from "../../../model/managers/GameStateManager.js";
import { Time } from "../../../../shared/socketTypes/socketTypes.js";

describe("GameStateManager", () => {
  let gameStateManager: GameStateManager;

  beforeEach(() => {
    gameStateManager = new GameStateManager();
  });

  it("should update state", () => {
    gameStateManager.setCurrentPhase(Time.Day);
    gameStateManager.setDayNumber(1);

    const snapshot = gameStateManager.getSnapshot();

    expect(snapshot.currentPhase).toBe(Time.Day);
    expect(snapshot.dayNumber).toBe(1);
  });

  it("should increment day number", () => {
    gameStateManager.setDayNumber(1);
    gameStateManager.incrementDayNumber();
    expect(gameStateManager.getSnapshot().dayNumber).toBe(2);
  });
});
