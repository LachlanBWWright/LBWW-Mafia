import { Server, Socket } from "socket.io";
import axios from "axios";
import { fromThrowable, ResultAsync } from "neverthrow";
import { httpServer } from "./httpServer.js";
import { Room } from "../model/rooms/room.js";

export type ClientToServerEvents = {
  playerJoinRoom: (
    captchaToken: string,
    cb: (result: string | number) => void,
  ) => Promise<void>;
  disconnect: () => void;
  messageSentByUser: (message: string, isDay: boolean) => void;
  handleVote: (recipient: number | null, isDay: boolean) => void;
  handleVisit: (recipient: number | null, isDay: boolean) => void;
  handleWhisper: (recipient: number, message: string, isDay: boolean) => void;
};

type PlayerList = {
  name: string;
  isAlive: boolean | undefined;
  role: string;
};

type PlayerReturned = {
  name: string;
  role: string;
  dayVisitSelf: boolean;
  dayVisitOthers: boolean;
  dayVisitFaction: boolean;
  nightVisitSelf: boolean;
  nightVisitOthers: boolean;
  nightVisitFaction: boolean;
  nightVote: boolean;
};

export type ServerToClientEvents = {
  //receive-message
  receiveMessage: (message: string) => void;
  blockMessages: () => void;
  "receive-new-player": (player: { name: string }) => void;
  "remove-player": (player: { name: string }) => void;
  "receive-player-list": (playerList: PlayerList[]) => void;
  "receive-chat-message": (message: string) => void;
  "receive-whisper-message": (message: string) => void;
  "update-day-time": (data: {
    time: string;
    dayNumber: number;
    timeLeft: number;
  }) => void;
  "disable-voting": () => void;
  "update-player-role": (data: { name: string; role?: string }) => void;
  "assign-player-role": (data: PlayerReturned) => void;
  "update-faction-role": (data: { name: string; role: string }) => void;
  "receive-role": (role: string) => void;
  "update-player-visit": () => void;
};

export type InterServerEvents = Record<string, never>;

export type SocketData = {
  roomObject: Room;
  position: number;
};

export const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: ["http://localhost:3000"],
  },
});

const playRoom: { current: Room | undefined } = {
  current: undefined,
};
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

export type PlayerSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function addSocketListeners(
  io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  roomSize: number,
) {
  io.on("connection", (socket: PlayerSocket) => {
    console.log("New Connection");
    //Handle players joining a room
    socket.on(
      "playerJoinRoom",
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
              //Blocks players from joining if ReCaptcha V3 score is too low, allows regardless if debug mode is on
              if (playRoom.current?.started || playRoom.current === undefined)
                playRoom.current = new Room(roomSize);
              console.log("playroomCurrent", playRoom.current);
              if (playRoom.current !== undefined) {
                socket.data.roomObject = playRoom.current;
                socket.join(playRoom.current.name); //Joins room, messages will be received accordingly
                const result = socket.data.roomObject.addPlayer(socket);
                console.log("Result: " + result);
                cb(result);
              }
            } else cb(2);
            console.log("END");
          },
          (error) => {
            console.error("Captcha verification failed: " + error);
            cb(2);
          },
        );
      },
    );

    //Handles users disconnecting from a room
    socket.on("disconnect", () => {
      runSafely("Disconnect error", () => {
        if (socket.data.roomObject !== undefined) {
          socket.data.roomObject.removePlayer(socket.id);
        }
      });
    });

    //Handle users sending a chat message to all other players
    socket.on("messageSentByUser", (message, isDay: boolean) => {
      runSafely("messageSentByUser error", () => {
        if (message.length > 0 && message.length <= 150) {
          if (socket.data.roomObject !== undefined)
            socket.data.roomObject.handleSentMessage(socket, message, isDay);
        }
      });
    });

    //Handles a player voting for another player - Recipient is the player's position in the array
    socket.on("handleVote", (recipient, isDay: boolean) => {
      runSafely("handleVote error", () => {
        if (typeof recipient === "number") {
          if (socket.data.roomObject !== undefined)
            socket.data.roomObject.handleVote(socket, recipient, isDay);
        }
      });
    });

    //Handles a player visiting another player - Recipient is the player's position in the array
    socket.on("handleVisit", (recipient, isDay: boolean) => {
      runSafely("handleVisit error", () => {
        if (typeof recipient === "number" || recipient === null) {
          if (socket.data.roomObject !== undefined)
            socket.data.roomObject.handleVisit(socket, recipient, isDay);
        }
      });
    });

    //Handles a player whispering to another player - Recipient is the player's position in the array
    socket.on("handleWhisper", (recipient, message, isDay) => {
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
