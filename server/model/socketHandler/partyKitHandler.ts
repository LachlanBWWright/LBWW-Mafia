import { SocketHandler } from "./socketHandler.js";
import { type MessageToClient } from "../../../shared/socketTypes/socketTypes.js";
import type * as Party from "partykit/server";

export class PartyKitHandler extends SocketHandler {
  room: Party.Room;
  constructor(room: Party.Room) {
    super();
    this.room = room;
  }

  sendPlayerMessage(playerSocketId: string, message: MessageToClient): void {
    const player = this.room.getConnection(playerSocketId);
    console.debug("PartyKitHandler.sendPlayerMessage", {
      playerSocketId,
      found: !!player,
      roomId: this.room.id,
      messageName: message.name,
    });
    if (!player) {
      console.error(`Player with ID ${playerSocketId} not found in room.`);
      return;
    }
    player.send(JSON.stringify(message));
  }

  sendRoomMessage(_roomId: string, message: MessageToClient): void {
    console.debug("PartyKitHandler.sendRoomMessage", {
      roomId: this.room.id,
      messageName: message.name,
    });
    this.room.broadcast(JSON.stringify(message));
  }

  //No partykit disconnect method, so this is a no-op
  disconnectSockets(): void {
    console.log("PartyKit disconnectSockets called - no action taken.");
  }
}
