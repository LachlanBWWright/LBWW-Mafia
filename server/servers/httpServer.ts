import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

const requestWindowMs = 60_000;
const maxRequestsPerWindow = 120;
const requestLog = new Map<string, { count: number; start: number }>();

app.use((req, res, next) => {
  const key = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const existing = requestLog.get(key);

  if (!existing || now - existing.start > requestWindowMs) {
    requestLog.set(key, { count: 1, start: now });
    next();
    return;
  }

  if (existing.count >= maxRequestsPerWindow) {
    res.status(429).send("Too many requests");
    return;
  }

  existing.count += 1;
  requestLog.set(key, existing);
  next();
});

app.use(express.static(path.join(__dirname + "/../client/build"))); //Serves the web app

export const httpServer = createServer(app);

app.get(/.*/, (_, res) => {
  res.status(404).send("Not found");
});
