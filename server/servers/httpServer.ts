import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

app.use(express.static(path.join(__dirname + "/../client/build"))); //Serves the web app

export const httpServer = createServer(app);

app.get(/.*/, (_, res) => {
  res.sendFile(path.join(__dirname + "/../client/build/index.html"));
});
