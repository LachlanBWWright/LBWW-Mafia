import "dotenv/config";
import { createSocketIoServer, addSocketListeners } from "./servers/socket";
import { setGameEmitter } from "./servers/emitter";
import { httpServer } from "./servers/httpServer";

/**
 * Server entry point. Initializes Socket.IO backend and starts HTTP server.
 * Sets up game event listeners and message handlers.
 */
const roomSize = parseInt(process.env.ROOM_SIZE || "13", 10);

// Initialize Socket.IO as the backend
const socketIoServer = createSocketIoServer();
setGameEmitter(socketIoServer);

addSocketListeners(socketIoServer, roomSize);

httpServer.listen(process.env.PORT || 8000, () => {
  console.log(`App listening on port: ${process.env.PORT || 8000}`);
});
