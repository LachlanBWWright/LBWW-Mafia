import { z } from "zod";
import type * as Party from "partykit/server";
import { PartyKitHandler } from "../model/socketHandler/partyKitHandler.js";
import { Room } from "../model/rooms/room.js";

// Module-level zod schema for validating incoming Party messages (created once)
const messageSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("playerJoinRoom"),
    data: z.object({ playerUsername: z.string() }),
  }),
  z.object({
    name: z.literal("messageSentByUser"),
    data: z.object({ message: z.string(), isDay: z.boolean() }),
  }),
  z.object({
    name: z.literal("handleVote"),
    data: z.object({
      recipient: z.union([z.number(), z.null()]),
      isDay: z.boolean(),
    }),
  }),
  z.object({
    name: z.literal("handleVisit"),
    data: z.object({
      recipient: z.union([z.number(), z.null()]),
      isDay: z.boolean(),
    }),
  }),
  z.object({
    name: z.literal("handleWhisper"),
    data: z.object({
      recipient: z.number(),
      message: z.string(),
      isDay: z.boolean(),
    }),
  }),
]);

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
    // Validate incoming messages using the module-level `messageSchema` (created once)

    let parsed: unknown;
    console.log(message);
    try {
      parsed = JSON.parse(message);
    } catch {
      parsed = undefined;
    }

    const parsedMsg = messageSchema.safeParse(parsed);
    if (!parsedMsg.success) return;

    const msg = parsedMsg.data; // strongly-typed by zod

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
            name: "joinRoomCallback",
            data: { result },
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
            message: `Unknown event: ${JSON.stringify(parsed)}`,
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
