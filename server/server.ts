import "dotenv/config";
import mongoose from "mongoose";
import { io, addSocketListeners } from "./servers/socket";
import { httpServer } from "./servers/httpServer";

if (process.env.ATLAS_URI == undefined) {
  console.error("ATLAS_URI not defined in .env file");
  process.exit(1);
}
mongoose.connect(process.env.ATLAS_URI);

const roomSize = parseInt(process.env.ROOM_SIZE || "13", 10);

addSocketListeners(io, roomSize);

httpServer.listen(process.env.PORT || 8000, () => {
  console.log(`App listening on port: ${process.env.PORT || 8000}`);
});
