import { describe, it, expect, beforeEach } from "vitest";
import { PlayerRegistry } from "../../model/managers/PlayerRegistry.js";
import { Player } from "../../model/player/player.js";

describe("PlayerRegistry", () => {
  let registry: PlayerRegistry;
  let player1: Player;
  let player2: Player;
  let player3: Player;

  beforeEach(() => {
    registry = new PlayerRegistry();
    player1 = new Player("socket1", "Alice", 0);
    player2 = new Player("socket2", "Bob", 1);
    player3 = new Player("socket3", "Charlie", 2);
  });

  describe("Player Management", () => {
    it("should add players", () => {
      registry.addPlayer(player1);
      expect(registry.getPlayerCount()).toBe(1);
    });

    it("should remove players", () => {
      registry.addPlayer(player1);
      registry.addPlayer(player2);
      registry.removePlayer(player1);

      expect(registry.getPlayerCount()).toBe(1);
      expect(registry.findBySocketId("socket1")).toBe(null);
    });

    it("should update positions after removal", () => {
      registry.addPlayer(player1);
      registry.addPlayer(player2);
      registry.addPlayer(player3);

      registry.removePlayer(player2);

      expect(player3.position).toBe(1);
    });

    it("should remove by socket ID", () => {
      registry.addPlayer(player1);
      const removed = registry.removePlayerBySocketId("socket1");

      expect(removed).toBe(player1);
      expect(registry.getPlayerCount()).toBe(0);
    });
  });

  describe("Player Queries", () => {
    beforeEach(() => {
      registry.addPlayer(player1);
      registry.addPlayer(player2);
      registry.addPlayer(player3);
      player1.isAlive = true;
      player2.isAlive = false;
      player3.isAlive = true;
    });

    it("should get all players", () => {
      const players = registry.getAllPlayers();
      expect(players).toHaveLength(3);
    });

    it("should get alive players", () => {
      const alive = registry.getAlivePlayers();
      expect(alive).toHaveLength(2);
      expect(alive).toContain(player1);
      expect(alive).toContain(player3);
    });

    it("should get dead players", () => {
      const dead = registry.getDeadPlayers();
      expect(dead).toHaveLength(1);
      expect(dead).toContain(player2);
    });

    it("should count alive players", () => {
      expect(registry.getAlivePlayerCount()).toBe(2);
    });

    it("should find by socket ID", () => {
      const found = registry.findBySocketId("socket2");
      expect(found).toBe(player2);
    });

    it("should find by username", () => {
      const found = registry.findByUsername("Charlie");
      expect(found).toBe(player3);
    });

    it("should find by position", () => {
      const found = registry.findByPosition(1);
      expect(found).toBe(player2);
    });

    it("should check if socket ID exists", () => {
      expect(registry.hasSocketId("socket1")).toBe(true);
      expect(registry.hasSocketId("socket99")).toBe(false);
    });

    it("should check if username is taken", () => {
      expect(registry.isUsernameTaken("Alice")).toBe(true);
      expect(registry.isUsernameTaken("David")).toBe(false);
    });

    it("should get taken usernames", () => {
      const names = registry.getTakenUsernames();
      expect(names).toHaveLength(3);
      expect(names).toContain("Alice");
      expect(names).toContain("Bob");
      expect(names).toContain("Charlie");
    });
  });

  describe("Vote Management", () => {
    beforeEach(() => {
      registry.addPlayer(player1);
      registry.addPlayer(player2);
      player1.hasVoted = true;
      player1.votesReceived = 2;
      player2.hasVoted = false;
      player2.votesReceived = 1;
    });

    it("should reset votes", () => {
      registry.resetVotes();

      expect(player1.hasVoted).toBe(false);
      expect(player1.votesReceived).toBe(0);
      expect(player2.hasVoted).toBe(false);
      expect(player2.votesReceived).toBe(0);
    });

    it("should get players who voted", () => {
      const voted = registry.getPlayersWhoVoted();
      expect(voted).toHaveLength(1);
      expect(voted).toContain(player1);
    });

    it("should get players who haven't voted", () => {
      player2.isAlive = true;
      const notVoted = registry.getPlayersWhoHaventVoted();
      expect(notVoted).toHaveLength(1);
      expect(notVoted).toContain(player2);
    });
  });

  describe("Clear", () => {
    it("should clear all players", () => {
      registry.addPlayer(player1);
      registry.addPlayer(player2);

      registry.clear();

      expect(registry.getPlayerCount()).toBe(0);
      expect(registry.getAllPlayers()).toHaveLength(0);
    });
  });
});
