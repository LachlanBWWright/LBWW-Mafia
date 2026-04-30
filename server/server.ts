import "dotenv/config";
import { createSocketIoServer, addSocketListeners } from "./servers/socket";
import { setGameEmitter } from "./servers/emitter";
import { httpServer } from "./servers/httpServer";

/**
 * Server entry point. Initializes Socket.IO backend and starts HTTP server.
 * Sets up game event listeners and message handlers.
 */
const DEFAULT_ROOM_SIZE = parseInt(process.env.ROOM_SIZE || "13", 10);
const DEFAULT_HTTP_PORT = 8000;

// Initialize Socket.IO as the backend
const socketIoServer = createSocketIoServer();
setGameEmitter(socketIoServer);

addSocketListeners(socketIoServer, DEFAULT_ROOM_SIZE);

httpServer.listen(process.env.PORT || DEFAULT_HTTP_PORT, () => {
  console.log(
    `App listening on port: ${process.env.PORT || DEFAULT_HTTP_PORT}`,
  );
});
