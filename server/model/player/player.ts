export class Player {
  socketId: string;
  playerUsername: string;
  role: any;
  isAlive: boolean;
  hasVoted: boolean;
  votesReceived: number;
  position: number;

  constructor(socketId: string, playerUsername: string, position: number) {
    this.socketId = socketId;
    this.playerUsername = playerUsername;
    this.role;
    this.isAlive = true;
    this.hasVoted = false;
    this.votesReceived = 0;
    this.position = position;
  }
}
