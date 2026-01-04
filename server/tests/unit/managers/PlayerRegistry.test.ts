import { describe, it, expect, beforeEach } from "vitest";
import { PlayerRegistry } from "../../../model/managers/PlayerRegistry.js";
import { Player } from "../../../model/player/player.js";
import { RoleGroup } from "../../../../shared/roles/roleEnums.js";

describe("PlayerRegistry", () => {
  let playerRegistry: PlayerRegistry;

  beforeEach(() => {
    playerRegistry = new PlayerRegistry();
  });

  it("should add and get players", () => {
    const player = new Player("p1", "Player 1", RoleGroup.Villager);
    playerRegistry.addPlayer(player);

    expect(playerRegistry.findBySocketId("p1")).toBe(player);
    expect(playerRegistry.getAllPlayers()).toContain(player);
  });

  it("should remove players", () => {
    const player = new Player("p1", "Player 1", RoleGroup.Villager);
    playerRegistry.addPlayer(player);
    playerRegistry.removePlayerBySocketId("p1");

    expect(playerRegistry.findBySocketId("p1")).toBeNull();
  });
});
