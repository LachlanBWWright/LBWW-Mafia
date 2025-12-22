import { type MessageToClient } from "../../../shared/socketTypes/socketTypes.js";

export abstract class SocketHandler {
  abstract sendPlayerMessage(
    playerSocketId: string,
    message: MessageToClient,
  ): void;
  sendPlayerMessages(playerSocketIds: string[], message: MessageToClient) {
    playerSocketIds.forEach((playerSocketId) => {
      this.sendPlayerMessage(playerSocketId, message);
    });
  }
  abstract sendRoomMessage(roomId: string, message: MessageToClient): void;
  abstract disconnectSockets(roomId: string): void;
}
