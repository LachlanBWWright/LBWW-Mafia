import type { Player } from "../player/player.js";

/**
 * Player registry for managing player list and queries
 *
 * Responsibilities:
 * - Player list management
 * - Player queries (alive, dead, by position, by socket, etc.)
 * - Player position management
 */
export class PlayerRegistry {
  private players: Player[] = [];

  /**
   * Add a player to the registry
   */
  addPlayer(player: Player): void {
    this.players.push(player);
  }

  /**
   * Remove a player from the registry
   */
  removePlayer(player: Player): void {
    const index = this.players.indexOf(player);
    if (index > -1) {
      this.players.splice(index, 1);
      // Update positions of subsequent players
      for (let i = index; i < this.players.length; i++) {
        const p = this.players[i];
        if (p) {
          p.position = i;
        }
      }
    }
  }

  /**
   * Remove a player by socket ID
   */
  removePlayerBySocketId(socketId: string): Player | null {
    const player = this.findBySocketId(socketId);
    if (player) {
      this.removePlayer(player);
      return player;
    }
    return null;
  }

  /**
   * Get all players
   */
  getAllPlayers(): readonly Player[] {
    return [...this.players];
  }

  /**
   * Get all alive players
   */
  getAlivePlayers(): Player[] {
    return this.players.filter((p) => p.isAlive);
  }

  /**
   * Get all dead players
   */
  getDeadPlayers(): Player[] {
    return this.players.filter((p) => !p.isAlive);
  }

  /**
   * Get player count
   */
  getPlayerCount(): number {
    return this.players.length;
  }

  /**
   * Get alive player count
   */
  getAlivePlayerCount(): number {
    return this.getAlivePlayers().length;
  }

  /**
   * Find player by socket ID
   */
  findBySocketId(socketId: string): Player | null {
    return this.players.find((p) => p.socketId === socketId) ?? null;
  }

  /**
   * Find player by username
   */
  findByUsername(username: string): Player | null {
    return this.players.find((p) => p.playerUsername === username) ?? null;
  }

  /**
   * Find player by position
   */
  findByPosition(position: number): Player | null {
    return this.players[position] ?? null;
  }

  /**
   * Check if a socket ID is in the registry
   */
  hasSocketId(socketId: string): boolean {
    return this.findBySocketId(socketId) !== null;
  }

  /**
   * Check if a username is taken
   */
  isUsernameTaken(username: string): boolean {
    return this.findByUsername(username) !== null;
  }

  /**
   * Get all taken usernames
   */
  getTakenUsernames(): string[] {
    return this.players.map((p) => p.playerUsername);
  }

  /**
   * Reset player votes and vote counts
   */
  resetVotes(): void {
    for (const player of this.players) {
      player.hasVoted = false;
      player.votesReceived = 0;
    }
  }

  /**
   * Get players who have voted
   */
  getPlayersWhoVoted(): Player[] {
    return this.players.filter((p) => p.hasVoted);
  }

  /**
   * Get players who haven't voted
   */
  getPlayersWhoHaventVoted(): Player[] {
    return this.players.filter((p) => !p.hasVoted && p.isAlive);
  }

  /**
   * Clear all players
   */
  clear(): void {
    this.players = [];
  }
}
