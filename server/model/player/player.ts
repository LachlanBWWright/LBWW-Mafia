import { PlayerSocket } from "../../servers/socket.js";
import { Room } from "../rooms/room.js";
import { type Role } from "../roles/abstractRole.js";

export class Player {
  socket: PlayerSocket;
  socketId: string;
  playerUsername: string;
  role: Role | undefined;
  isAlive: boolean;
  hasVoted: boolean;
  votesReceived: number;

  constructor(
    socket: PlayerSocket,
    socketId: string,
    playerUsername: string,
    _room: Room,
  ) {
    this.socket = socket;
    this.socketId = socketId;
    this.playerUsername = playerUsername;
    this.role = undefined;
    this.isAlive = true;
    this.hasVoted = false;
    this.votesReceived = 0;
  }
}
