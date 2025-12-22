import { describe, it, expect } from "vitest";
import { RoleGroup, RoleName } from "../../../shared/roles/roleEnums.js";

/**
 * Unit tests for core Mafia game logic and mechanics
 * These tests simulate a complete game match without external dependencies
 */
describe("Mafia Game - Core Logic Simulation", () => {
  // Simple Player class for testing
  class TestPlayer {
    socketId: string;
    playerUsername: string;
    isAlive = true;
    hasVoted = false;
    votesReceived = 0;
    position: number;
    role: { name: string; group: RoleGroup } | null = null;

    constructor(socketId: string, playerUsername: string, position: number) {
      this.socketId = socketId;
      this.playerUsername = playerUsername;
      this.position = position;
    }
  }

  // Simple Room class for testing
  class TestRoom {
    name: string;
    size: number;
    playerCount = 0;
    playerList: TestPlayer[] = [];
    started = false;
    time: "day" | "night" | "" = "";
    gameHasEnded = false;

    constructor(size: number) {
      this.name = `test-room-${Date.now()}`;
      this.size = size;
    }

    addPlayer(socketId: string, username: string): TestPlayer | null {
      if (this.playerCount >= this.size) return null;

      const player = new TestPlayer(socketId, username, this.playerCount);
      this.playerList.push(player);
      this.playerCount++;

      if (this.playerCount === this.size) {
        this.startGame();
      }

      return player;
    }

    startGame() {
      this.started = true;
      this.time = "day";
      this.assignRoles();
    }

    assignRoles() {
      // Simple role assignment for testing
      const roles = this.generateRoles(this.size);
      this.playerList.forEach((player, index) => {
        player.role = roles[index] ?? {
          name: "Civilian",
          group: RoleGroup.Town,
        };
      });
    }

    generateRoles(playerCount: number): { name: string; group: RoleGroup }[] {
      const roles: { name: string; group: RoleGroup }[] = [];

      // Simple balanced role assignment
      if (playerCount >= 3) {
        roles.push({ name: RoleName.Mafia, group: RoleGroup.Mafia });
      }
      if (playerCount >= 4) {
        roles.push({ name: RoleName.Doctor, group: RoleGroup.Town });
      }
      if (playerCount >= 5) {
        roles.push({ name: RoleName.Investigator, group: RoleGroup.Town });
      }
      if (playerCount >= 6) {
        roles.push({ name: RoleName.Maniac, group: RoleGroup.Neutral });
      }

      // Fill remaining with town roles
      while (roles.length < playerCount) {
        roles.push({ name: "Civilian", group: RoleGroup.Town });
      }

      // Shuffle roles
      for (let i = roles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [roles[i], roles[j]] = [roles[j]!, roles[i]!];
      }

      return roles;
    }
  }

  // Helper functions
  function simulateVoting(
    room: TestRoom,
    votes: { voter: number; target: number }[],
  ): void {
    // Reset votes
    room.playerList.forEach((p) => {
      p.votesReceived = 0;
      p.hasVoted = false;
    });

    // Apply votes
    votes.forEach(({ voter, target }) => {
      const voterPlayer = room.playerList[voter];
      const targetPlayer = room.playerList[target];

      if (voterPlayer?.isAlive && targetPlayer?.isAlive) {
        targetPlayer.votesReceived++;
        voterPlayer.hasVoted = true;
      }
    });
  }

  function getEliminationTarget(room: TestRoom): TestPlayer | null {
    const alivePlayers = room.playerList.filter((p) => p.isAlive);
    const requiredVotes = Math.floor(alivePlayers.length / 2) + 1;

    let maxVotes = 0;
    let playersWithMaxVotes: TestPlayer[] = [];

    alivePlayers.forEach((player) => {
      if (player.votesReceived > maxVotes) {
        maxVotes = player.votesReceived;
        playersWithMaxVotes = [player];
      } else if (player.votesReceived === maxVotes && maxVotes > 0) {
        playersWithMaxVotes.push(player);
      }
    });

    if (maxVotes >= requiredVotes && playersWithMaxVotes.length === 1) {
      return playersWithMaxVotes[0]!;
    }

    return null;
  }

  function eliminatePlayer(room: TestRoom, player: TestPlayer): void {
    player.isAlive = false;
    // Reset voting state
    room.playerList.forEach((p) => {
      p.votesReceived = 0;
      p.hasVoted = false;
    });
  }

  function checkWinCondition(room: TestRoom): RoleGroup | null {
    const alivePlayers = room.playerList.filter((p) => p.isAlive);

    if (alivePlayers.length === 0) return null;

    const aliveTown = alivePlayers.filter(
      (p) => p.role?.group === RoleGroup.Town,
    ).length;
    const aliveMafia = alivePlayers.filter(
      (p) => p.role?.group === RoleGroup.Mafia,
    ).length;
    const aliveNeutral = alivePlayers.filter(
      (p) => p.role?.group === RoleGroup.Neutral,
    ).length;

    // Mafia wins if they equal or outnumber town
    if (aliveMafia >= aliveTown && aliveNeutral === 0) {
      return RoleGroup.Mafia;
    }

    // Town wins if no mafia or hostile neutrals remain
    if (aliveMafia === 0 && aliveNeutral === 0) {
      return RoleGroup.Town;
    }

    // Neutral wins if they're the sole survivor
    if (alivePlayers.length === 1 && aliveNeutral === 1) {
      return RoleGroup.Neutral;
    }

    return null;
  }

  describe("Game Setup and Initialization", () => {
    it("should create room with correct initial state", () => {
      const room = new TestRoom(6);

      expect(room.size).toBe(6);
      expect(room.playerCount).toBe(0);
      expect(room.started).toBe(false);
      expect(room.time).toBe("");
      expect(room.gameHasEnded).toBe(false);
      expect(room.playerList).toHaveLength(0);
    });

    it("should add players to room", () => {
      const room = new TestRoom(4);

      const player1 = room.addPlayer("socket1", "Alice");
      const player2 = room.addPlayer("socket2", "Bob");

      expect(player1).toBeTruthy();
      expect(player2).toBeTruthy();
      expect(room.playerCount).toBe(2);
      expect(room.playerList).toHaveLength(2);
    });

    it("should start game when room is full", () => {
      const room = new TestRoom(3);

      room.addPlayer("socket1", "Alice");
      room.addPlayer("socket2", "Bob");
      room.addPlayer("socket3", "Charlie");

      expect(room.started).toBe(true);
      expect(room.time).toBe("day");
    });

    it("should assign roles when game starts", () => {
      const room = new TestRoom(4);

      room.addPlayer("socket1", "Alice");
      room.addPlayer("socket2", "Bob");
      room.addPlayer("socket3", "Charlie");
      room.addPlayer("socket4", "Diana");

      room.playerList.forEach((player) => {
        expect(player.role).toBeTruthy();
        expect(player.role!.name).toBeTruthy();
        expect([RoleGroup.Town, RoleGroup.Mafia, RoleGroup.Neutral]).toContain(
          player.role!.group,
        );
      });
    });
  });

  describe("Voting Mechanics", () => {
    it("should handle basic voting", () => {
      const room = new TestRoom(4);
      room.addPlayer("socket1", "Alice");
      room.addPlayer("socket2", "Bob");
      room.addPlayer("socket3", "Charlie");
      room.addPlayer("socket4", "Diana");

      simulateVoting(room, [
        { voter: 0, target: 1 }, // Alice votes Bob
        { voter: 2, target: 1 }, // Charlie votes Bob
        { voter: 3, target: 1 }, // Diana votes Bob
      ]);

      expect(room.playerList[1]!.votesReceived).toBe(3);
      expect(room.playerList[0]!.hasVoted).toBe(true);
      expect(room.playerList[2]!.hasVoted).toBe(true);
      expect(room.playerList[3]!.hasVoted).toBe(true);
    });

    it("should determine elimination target with majority", () => {
      const room = new TestRoom(5);
      for (let i = 0; i < 5; i++) {
        room.addPlayer(`socket${i}`, `Player${i}`);
      }

      // 3 votes out of 5 players (majority)
      simulateVoting(room, [
        { voter: 0, target: 1 },
        { voter: 2, target: 1 },
        { voter: 3, target: 1 },
      ]);

      const target = getEliminationTarget(room);
      expect(target).toBe(room.playerList[1]);
    });

    it("should not eliminate on tie votes", () => {
      const room = new TestRoom(4);
      for (let i = 0; i < 4; i++) {
        room.addPlayer(`socket${i}`, `Player${i}`);
      }

      // Tie vote: 1 vote each for players 1 and 2
      simulateVoting(room, [
        { voter: 0, target: 1 },
        { voter: 3, target: 2 },
      ]);

      const target = getEliminationTarget(room);
      expect(target).toBeNull();
    });

    it("should require majority for elimination", () => {
      const room = new TestRoom(5);
      for (let i = 0; i < 5; i++) {
        room.addPlayer(`socket${i}`, `Player${i}`);
      }

      // Only 2 votes out of 5 (not majority)
      simulateVoting(room, [
        { voter: 0, target: 1 },
        { voter: 2, target: 1 },
      ]);

      const target = getEliminationTarget(room);
      expect(target).toBeNull();
    });
  });

  describe("Game Flow and Win Conditions", () => {
    it("should detect town victory", () => {
      const room = new TestRoom(4);
      for (let i = 0; i < 4; i++) {
        room.addPlayer(`socket${i}`, `Player${i}`);
      }

      // Manually eliminate mafia players
      room.playerList.forEach((player) => {
        if (player.role?.group === RoleGroup.Mafia) {
          player.isAlive = false;
        }
      });

      const winner = checkWinCondition(room);
      expect(winner).toBe(RoleGroup.Town);
    });

    it("should detect mafia victory", () => {
      const room = new TestRoom(4);
      for (let i = 0; i < 4; i++) {
        room.addPlayer(`socket${i}`, `Player${i}`);
      }

      const mafiaPlayers = room.playerList.filter(
        (p) => p.role?.group === RoleGroup.Mafia,
      );
      const townPlayers = room.playerList.filter(
        (p) => p.role?.group === RoleGroup.Town,
      );

      // Kill town players until mafia has parity
      townPlayers.forEach((player, index) => {
        if (index < townPlayers.length - mafiaPlayers.length) {
          player.isAlive = false;
        }
      });

      const winner = checkWinCondition(room);
      if (mafiaPlayers.length > 0) {
        expect(winner).toBe(RoleGroup.Mafia);
      }
    });

    it("should continue game when no win condition met", () => {
      const room = new TestRoom(4);
      for (let i = 0; i < 4; i++) {
        room.addPlayer(`socket${i}`, `Player${i}`);
      }

      const winner = checkWinCondition(room);
      expect(winner).toBeNull();
    });
  });

  describe("Complete Game Simulation", () => {
    it("should simulate a complete game to victory", () => {
      const room = new TestRoom(5);
      for (let i = 0; i < 5; i++) {
        room.addPlayer(`socket${i}`, `Player${i}`);
      }

      let dayCount = 0;
      const maxDays = 10;

      while (!room.gameHasEnded && dayCount < maxDays) {
        // Day phase - vote out mafia if possible
        const aliveMafia = room.playerList.filter(
          (p) => p.isAlive && p.role?.group === RoleGroup.Mafia,
        );
        const aliveTown = room.playerList.filter(
          (p) => p.isAlive && p.role?.group === RoleGroup.Town,
        );

        if (aliveMafia.length > 0) {
          const target = aliveMafia[0]!;
          const votes = aliveTown.map((voter) => ({
            voter: room.playerList.indexOf(voter),
            target: room.playerList.indexOf(target),
          }));

          simulateVoting(room, votes);
          const eliminationTarget = getEliminationTarget(room);

          if (eliminationTarget) {
            eliminatePlayer(room, eliminationTarget);
          }
        }

        // Check win condition
        const winner = checkWinCondition(room);
        if (winner) {
          room.gameHasEnded = true;
          expect([
            RoleGroup.Town,
            RoleGroup.Mafia,
            RoleGroup.Neutral,
          ]).toContain(winner);
          break;
        }

        dayCount++;
      }

      expect(room.gameHasEnded).toBe(true);
    });

    it("should handle multiple eliminations", () => {
      const room = new TestRoom(6);
      for (let i = 0; i < 6; i++) {
        room.addPlayer(`socket${i}`, `Player${i}`);
      }

      const initialAlive = room.playerList.filter((p) => p.isAlive).length;
      expect(initialAlive).toBe(6);

      // Eliminate 3 players
      for (let i = 0; i < 3; i++) {
        const alivePlayer = room.playerList.find((p) => p.isAlive);
        if (alivePlayer) {
          eliminatePlayer(room, alivePlayer);
        }
      }

      const remainingAlive = room.playerList.filter((p) => p.isAlive).length;
      expect(remainingAlive).toBe(3);
    });
  });

  describe("Role Distribution Balance", () => {
    it("should create balanced teams for different game sizes", () => {
      const gameSizes = [4, 5, 6, 7, 8];

      gameSizes.forEach((size) => {
        const room = new TestRoom(size);
        for (let i = 0; i < size; i++) {
          room.addPlayer(`socket${i}`, `Player${i}`);
        }

        const roleCounts = room.playerList.reduce(
          (acc, player) => {
            const group = player.role?.group ?? "unknown";
            acc[group] = (acc[group] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

        // Should have at least 1 mafia and some town
        expect(roleCounts.mafia).toBeGreaterThanOrEqual(1);
        expect(roleCounts.town).toBeGreaterThanOrEqual(1);

        // Mafia should not outnumber town at start
        expect(roleCounts.mafia).toBeLessThan(roleCounts.town ?? 0);

        // Total should match game size
        const total = Object.values(roleCounts).reduce(
          (sum, count) => sum + count,
          0,
        );
        expect(total).toBe(size);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle room at capacity", () => {
      const room = new TestRoom(2);

      const player1 = room.addPlayer("socket1", "Alice");
      const player2 = room.addPlayer("socket2", "Bob");
      const player3 = room.addPlayer("socket3", "Charlie"); // Should fail

      expect(player1).toBeTruthy();
      expect(player2).toBeTruthy();
      expect(player3).toBeNull();
      expect(room.playerCount).toBe(2);
    });

    it("should handle voting with dead players", () => {
      const room = new TestRoom(4);
      for (let i = 0; i < 4; i++) {
        room.addPlayer(`socket${i}`, `Player${i}`);
      }

      // Kill one player
      room.playerList[0]!.isAlive = false;

      // Try to vote with dead player (should be filtered out)
      simulateVoting(room, [
        { voter: 0, target: 1 }, // Dead player voting
        { voter: 2, target: 1 }, // Alive player voting
      ]);

      // Only alive player's vote should count
      expect(room.playerList[1]!.votesReceived).toBe(1);
    });

    it("should handle empty game state", () => {
      const room = new TestRoom(3);

      expect(() => {
        const winner = checkWinCondition(room);
        expect(winner).toBeNull();
      }).not.toThrow();
    });
  });
});
