import "dotenv/config";
import { io, addSocketListeners } from "./servers/socketio.js";
import { httpServer } from "./servers/httpServer.js";

const roomSize = parseInt(process.env.ROOM_SIZE ?? "13", 10);

addSocketListeners(io, roomSize);

httpServer.listen(process.env.PORT ?? 8000, () => {
  console.log(`App listening on port: ${String(process.env.PORT ?? 8000)}`);
});
