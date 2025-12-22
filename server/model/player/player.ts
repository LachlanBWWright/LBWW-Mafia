import { type Role } from "../roles/abstractRole.js";

export class Player {
  socketId: string;
  playerUsername: string;
  role!: Role;
  isAlive: boolean;
  hasVoted: boolean;
  votesReceived: number;
  position: number;

  constructor(socketId: string, playerUsername: string, position: number) {
    this.socketId = socketId;
    this.playerUsername = playerUsername;
    this.isAlive = true;
    this.hasVoted = false;
    this.votesReceived = 0;
    this.position = position;
  }
}
