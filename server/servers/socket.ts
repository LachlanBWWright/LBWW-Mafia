import { Server, Socket } from "socket.io";
import axios from "axios";
import { fromThrowable, ResultAsync } from "neverthrow";
import { httpServer } from "./httpServer.js";
import { Room } from "../model/rooms/room.js";
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents } from "../../shared/communication/events.js";
import { ClientEvent } from "../../shared/communication/events.js";

export type SocketData = {
  roomObject: Room;
  position: number;
};

export type PlayerSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function createSocketIoServer() {
  return new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: ["http://localhost:3000"],
    },
  });
}

const DEBUG_MODE =
  process.env.DEBUG?.toLowerCase() === "true" ||
  process.env.debug?.toLowerCase() === "true";

const runSafely = (context: string, action: () => void) => {
  const safeAction = fromThrowable(action, (error) => error);
  const result = safeAction();

  if (result.isErr()) {
    console.error(`${context}: ${String(result.error)}`);
  }
};

export function addSocketListeners(
  socketIoServer: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  roomSize: number,
) {
  const playRoom: { current: Room | undefined } = { current: undefined };

  socketIoServer.on("connection", (socket: PlayerSocket) => {
    console.log("New Connection");
    socket.on(
      ClientEvent.PlayerJoinRoom,
      async (captchaToken: string, cb: (code: string | number) => void) => {
        await ResultAsync.fromPromise(
          axios.post(
            `https://www.google.com/recaptcha/api/siteverify?response=${captchaToken}&secret=${process.env.CAPTCHA_KEY}`,
          ),
          (error) => error,
        ).match(
          (res) => {
            if (res.data.success || DEBUG_MODE) {
              console.log("Captcha Success");
              if (playRoom.current?.started || playRoom.current === undefined)
                playRoom.current = new Room(roomSize);
              if (playRoom.current !== undefined) {
                socket.data.roomObject = playRoom.current;
                socket.join(playRoom.current.name);
                const result = socket.data.roomObject.addUser(socket);
                console.log("Result: " + result);
                cb(result);
              }
            } else cb(2);
          },
          (error) => {
            console.error(`Captcha verification failed: ${String(error)}`);
            cb(2);
          },
        );
      },
    );

    socket.on(ClientEvent.Disconnect, () => {
      runSafely("Disconnect error", () => {
        if (socket.data.roomObject !== undefined) {
          socket.data.roomObject.removePlayer(socket.id);
        }
      });
    });

    socket.on(ClientEvent.MessageSentByUser, (message, isDay: boolean) => {
      runSafely("messageSentByUser error", () => {
        if (message.length > 0 && message.length <= 150) {
          if (socket.data.roomObject !== undefined)
            socket.data.roomObject.handleSentMessage(socket, message, isDay);
        }
      });
    });

    socket.on(ClientEvent.HandleVote, (recipient, isDay: boolean) => {
      runSafely("handleVote error", () => {
        if (typeof recipient === "number") {
          if (socket.data.roomObject !== undefined)
            socket.data.roomObject.handleVote(socket, recipient, isDay);
        }
      });
    });

    socket.on(ClientEvent.HandleVisit, (recipient, isDay: boolean) => {
      runSafely("handleVisit error", () => {
        if (typeof recipient === "number" || recipient === null) {
          if (socket.data.roomObject !== undefined)
            socket.data.roomObject.handleVisit(socket, recipient, isDay);
        }
      });
    });

    socket.on(ClientEvent.HandleWhisper, (recipient, message, isDay) => {
      runSafely("handleWhisper error", () => {
        if (
          typeof recipient === "number" &&
          message.length > 0 &&
          message.length <= 150
        ) {
          if (socket.data.roomObject !== undefined)
            socket.data.roomObject.handleWhisper(
              socket,
              recipient,
              message,
              isDay,
            );
        }
      });
    });
  });
}
