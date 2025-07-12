import { MessageToClient } from "../../../shared/socketTypes/socketTypes";
import { SocketHandler } from "./socketHandler";
import { io } from "../../servers/socketio";

export class SocketIoHandler extends SocketHandler {
  sendPlayerMessage(playerSocketId: string, message: MessageToClient): void {
    SocketIoHandler.sendIoMessage(playerSocketId, message);
  }

  sendRoomMessage(roomId: string, message: MessageToClient): void {
    SocketIoHandler.sendIoMessage(roomId, message);
  }

  disconnectSockets(roomId: string): void {
    io.in(roomId).disconnectSockets();
  }

  private static sendIoMessage(recipientId: string, message: MessageToClient) {
    switch (message.name) {
      case "receiveMessage":
        io.to(recipientId).emit("receiveMessage", message.data.message);
        break;
      case "blockMessages":
        io.to(recipientId).emit("blockMessages");
        break;
      case "receive-new-player":
        io.to(recipientId).emit("receive-new-player", message.data.player);
        break;
      case "remove-player":
        io.to(recipientId).emit("remove-player", message.data.player);
        break;
      case "receive-player-list":
        io.to(recipientId).emit("receive-player-list", message.data.playerList);
        break;
      case "receive-chat-message":
        io.to(recipientId).emit("receive-chat-message", message.data.message);
        break;
      case "receive-whisper-message":
        io.to(recipientId).emit(
          "receive-whisper-message",
          message.data.message,
        );
        break;
      case "update-day-time":
        io.to(recipientId).emit("update-day-time", message.data);
        break;
      case "disable-voting":
        io.to(recipientId).emit("disable-voting");
        break;
      case "update-player-role":
        io.to(recipientId).emit("update-player-role", message.data);
        break;
      case "assign-player-role":
        io.to(recipientId).emit("assign-player-role", message.data);
        break;
      case "update-faction-role":
        io.to(recipientId).emit("update-faction-role", message.data);
        break;
      case "receive-role":
        io.to(recipientId).emit("receive-role", message.data.role);
        break;
      default:
        console.error(`Unknown message type: ${message.name}`);
    }
  }
}
