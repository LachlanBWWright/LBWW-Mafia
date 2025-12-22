import type * as Party from "partykit/server";
import { PartyKitHandler } from "../model/socketHandler/partyKitHandler.js";
import type { MessageToServer } from "../../shared/socketTypes/socketTypes.js";
import { Room } from "../model/rooms/room.js";

// This Party.Server implementation delegates socket logic to PartyKitHandler,
// so game logic can use the same socket API as Socket.IO.
export default class Server implements Party.Server {
  socketHandler: PartyKitHandler;
  playRoom: { current: Room | undefined } = { current: undefined };
  roomSize = 10; // Default, can be set via env or config

  constructor(readonly room: Party.Room) {
    this.socketHandler = new PartyKitHandler(room);
    // Optionally set roomSize from env/config here
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // Connection established
    console.log(
      `Connected:\n  id: ${conn.id}\n  room: ${this.room.id}\n  url: ${new URL(ctx.request.url).pathname}`,
    );
    // Optionally notify game logic here
    // Example: this.socketHandler.sendPlayerMessage(conn.id, { name: "receiveMessage", data: { message: "Welcome!" } });
    // No conn.on in PartyKit, all message handling is done in onMessage
  }

  onMessage(message: string, sender: Party.Connection) {
    let msg: MessageToServer | undefined;
    console.log(message);
    try {
      msg = JSON.parse(message) as MessageToServer;
    } catch {
      msg = undefined;
    }

    //TODO: REMOVE THIS TEST STUFF
    if (!msg || typeof msg !== "object" || !("name" in msg)) {
      return;
    }

    switch (msg.name) {
      case "playerJoinRoom": {
        // TODO: Add captcha verification if needed (PartyKit doesn't support server-side HTTP requests easily)
        if (
          this.playRoom.current?.started ??
          this.playRoom.current === undefined
        ) {
          this.playRoom.current = new Room(this.roomSize, this.socketHandler);
        }
        if (this.playRoom.current !== undefined) {
          const result = this.playRoom.current.addPlayer(sender.id);
          this.socketHandler.sendPlayerMessage(sender.id, {
            name: "receiveMessage",
            data: { message: `Join result: ${result}` },
          });
          // Send a join response so PartyKit clients can receive the result via callback
          this.socketHandler.sendPlayerMessage(sender.id, {
            name: "playerJoinResponse",
            data: result,
          });
        }
        break;
      }
      case "messageSentByUser": {
        const { message, isDay } = msg.data;
        if (message && message.length > 0 && message.length <= 150) {
          if (this.playRoom.current)
            this.playRoom.current.handleSentMessage(sender.id, message, isDay);
        }
        break;
      }
      case "handleVote": {
        const { recipient, isDay } = msg.data;
        if (this.playRoom.current && typeof recipient === "number")
          this.playRoom.current.handleVote(sender.id, recipient, isDay);
        break;
      }
      case "handleVisit": {
        const { recipient, isDay } = msg.data;
        if (
          this.playRoom.current &&
          (typeof recipient === "number" || recipient === null)
        )
          this.playRoom.current.handleVisit(sender.id, recipient, isDay);
        break;
      }
      case "handleWhisper": {
        const { recipient, message, isDay } = msg.data;
        if (
          this.playRoom.current &&
          typeof recipient === "number" &&
          message &&
          message.length > 0 &&
          message.length <= 150
        )
          this.playRoom.current.handleWhisper(
            sender.id,
            recipient,
            message,
            isDay,
          );
        break;
      }
      default:
        this.socketHandler.sendPlayerMessage(sender.id, {
          name: "receiveMessage",
          data: {
            message: `Unknown event: ${String((msg as MessageToServer).name)}`,
          },
        });
        break;
    }
  }

  onClose(connection: Party.Connection): void | Promise<void> {
    console.log(`Disconnected: ${connection.id}`);
    this.playRoom.current?.removePlayer(connection.id);
  }
}
