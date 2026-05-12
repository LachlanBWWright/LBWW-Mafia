import type { User } from "../user/user.js";
import type { RoleLike } from "../roles/roleLike.js";

/**
 * Represents the in-game character of a connected User.
 * Players are only instantiated at the start of a game.
 * Their role may be changed mid-game (e.g. conversion mechanics).
 */
export class Player {
  readonly user: User;
  readonly username: string;
  role!: RoleLike; // always assigned during startGame() before any game logic runs
  isAlive: boolean;
  hasVoted: boolean;
  votesReceived: number;

  constructor(user: User) {
    this.user = user;
    this.username = user.username;
    this.isAlive = true;
    this.hasVoted = false;
    this.votesReceived = 0;
  }

  /** Assign or change this player's role (e.g. at game start or mid-game conversion). */
  assignRole(role: RoleLike) {
    this.role = role;
  }
}
