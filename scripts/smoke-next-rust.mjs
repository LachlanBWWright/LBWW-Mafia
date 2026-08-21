import WebSocket from "ws";

const url = process.env.NEXT_RUST_TEST_URL;
if (!url) throw new Error("NEXT_RUST_TEST_URL is required");

const timeoutMs = 10_000;
const clients = [new WebSocket(url), new WebSocket(url)];
const messages = [[], []];
clients.forEach((client, index) => {
  client.on("message", (data) => messages[index].push(JSON.parse(data.toString())));
});

function waitForOpen(client) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WebSocket open timed out")), timeoutMs);
    client.once("open", () => {
      clearTimeout(timer);
      resolve();
    });
    client.once("error", reject);
  });
}

function waitFor(index, predicate, label) {
  const existing = messages[index].find(predicate);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const poll = setInterval(() => {
      const message = messages[index].find(predicate);
      if (message) {
        clearInterval(poll);
        clearTimeout(timer);
        resolve(message);
      }
    }, 10);
    const timer = setTimeout(() => {
      clearInterval(poll);
      reject(new Error(`Timed out waiting for ${label}`));
    }, timeoutMs);
  });
}

try {
  await Promise.all(clients.map(waitForOpen));
  const callbacks = clients.map((client, index) => {
    const callbackId = `smoke-${index}`;
    const response = waitFor(
      index,
      (message) => message.type === "callback" && message.callbackId === callbackId,
      `join callback ${callbackId}`,
    );
    client.send(JSON.stringify({
      type: "event",
      event: "playerJoinRoom",
      args: ["dev-bypass-token"],
      callbackId,
    }));
    return response;
  });
  const results = await Promise.all(callbacks);
  if (results.some((message) => message.args?.[0]?.status !== "joined")) {
    throw new Error(`Unexpected join response: ${JSON.stringify(results)}`);
  }
  await Promise.all(clients.map((_, index) => waitFor(
    index,
    (message) => message.type === "event" && message.event === "assign-player-role",
    "role assignment",
  )));
  await waitFor(
    0,
    (message) => message.type === "event" && message.event === "update-day-time",
    "day phase event",
  );
  clients[0].send(JSON.stringify({
    type: "event",
    event: "messageSentByUser",
    args: ["integration hello", "Day"],
  }));
  await Promise.all(clients.map((_, index) => waitFor(
    index,
    (message) => message.type === "event"
      && message.event === "receive-chat-message"
      && message.args?.[0]?.includes("integration hello"),
    "broadcast chat message",
  )));

  clients[0].send(JSON.stringify({
    type: "event",
    event: "handleWhisper",
    args: [1, "integration secret", "Day"],
  }));
  await Promise.all(clients.map((_, index) => waitFor(
    index,
    (message) => message.type === "event"
      && message.event === "receive-whisper-message"
      && message.args?.[0]?.includes("integration secret"),
    "targeted whisper message",
  )));

  clients[0].send(JSON.stringify({
    type: "event",
    event: "handleVote",
    args: [1, "Day"],
  }));
  await waitFor(
    1,
    (message) => message.type === "event"
      && message.event === "receiveMessage"
      && message.args?.[0]?.key === "vote_cast_single",
    "room vote event",
  );
} finally {
  for (const client of clients) client.close();
}
