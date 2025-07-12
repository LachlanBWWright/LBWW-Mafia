import { SocketHandler } from "./socketHandler";
import { MessageToClient } from "../../../shared/socketTypes/socketTypes";
import type * as Party from "partykit/server";

export class PartyKitHandler extends SocketHandler {
  room: Party.Room;
  constructor(room: Party.Room) {
    super();
    this.room = room;
  }

  sendPlayerMessage(playerSocketId: string, message: MessageToClient): void {
    const player = this.room.getConnection(playerSocketId);
    if (!player) {
      console.error(`Player with ID ${playerSocketId} not found in room.`);
      return;
    }
    player.send(JSON.stringify(message));
  }

  sendRoomMessage(roomId: string, message: MessageToClient): void {
    /*     if (this.room.id !== roomId) {
      console.error(`Room with ID ${roomId} not found.`);
      return;
    } */
    this.room.broadcast(JSON.stringify(message));
  }

  //No partykit disconnect method, so this is a no-op
  disconnectSockets(): void {}
}
