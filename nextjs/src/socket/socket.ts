"use client";

import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "~/types/shared";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  "http://localhost:8000",
  {
    autoConnect: false,
    transports: ["websocket"],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
  },
);

console.log("Socket.io client instance:", socket);
socket.connect();

socket.on("connect", () => {
  console.log("Socket connected to server:", socket.id);
});

socket.on("disconnect", (reason: Socket.DisconnectReason) => {
  console.log("Socket disconnected from server:", reason);
});

socket.on("connect_error", (err: Error) => {
  console.error("Socket connection error:", err.message);
});
