import { test } from "node:test";
import assert from "node:assert/strict";
import { completedText } from "../../../shared/ai/inference.mjs";

const frame = (event) => `data: ${JSON.stringify(event)}\n\n`;
const message = (text) => ({
  type: "message",
  content: [{ type: "output_text", text }],
});
const completed = (output) => ({
  type: "response.completed",
  response: { output },
});

test("SSE framing survives every byte boundary, CRLF, multiline data and UTF-8 characters", async () => {
  const bytes = new TextEncoder().encode(
    `: heartbeat\r\n\r\ndata: [DONE]\r\n\r\ndata: {"type":"response.completed",\r\ndata: "response":{"output":[${JSON.stringify(message("Mafia 🕵️ café"))}]}}\r\n\r\n`,
  );
  const response = new Response(
    new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    }),
  );
  assert.equal(await completedText(response), "Mafia 🕵️ café");
});

test("completed output is authoritative and ordered item fallbacks exclude reasoning", async () => {
  const chunks =
    frame({
      type: "response.output_item.done",
      output_index: 2,
      item: message("second"),
    }) +
    frame({
      type: "response.output_item.done",
      output_index: 0,
      item: {
        type: "reasoning",
        content: [{ type: "output_text", text: "private" }],
      },
    }) +
    frame({
      type: "response.output_item.done",
      output_index: 1,
      item: message("first "),
    });
  assert.equal(
    await completedText(new Response(chunks + frame(completed([])))),
    "first second",
  );
  assert.equal(
    await completedText(
      new Response(chunks + frame(completed([message("authoritative")]))),
    ),
    "authoritative",
  );
});

for (const [name, body, code] of [
  ["empty completed output", frame(completed([])), "empty"],
  ["whitespace output", frame(completed([message(" \n")])), "empty"],
  [
    "refusal",
    frame(completed([{ type: "message", content: [{ type: "refusal" }] }])),
    "refused",
  ],
  [
    "interrupted delta",
    frame({ type: "response.output_text.delta", delta: "partial" }),
    "interrupted",
  ],
  ["incomplete", frame({ type: "response.incomplete" }), "incomplete"],
  ["failed without details", frame({ type: "response.failed" }), "incomplete"],
])
  test(`never accepts ${name} as a decision`, async () => {
    await assert.rejects(completedText(new Response(body)), { code });
  });

for (const type of ["response.failed", "error"])
  test(`preserves provider diagnostics for ${type}`, async () => {
    const error = {
      code: "subscription_sharing_usage_limit_exceeded",
      param: "model",
    };
    const event =
      type === "response.failed"
        ? { type, response: { error } }
        : { type, ...error };
    await assert.rejects(
      completedText(
        new Response(frame(event), {
          headers: { "x-request-id": "stream-request" },
        }),
      ),
      {
        code: "usage-limit",
        providerCode: error.code,
        param: "model",
        requestId: "stream-request",
        status: 200,
      },
    );
  });

test("enforces the stream byte limit", async () => {
  await assert.rejects(completedText(new Response("x".repeat(2_000_001))), {
    code: "too-large",
  });
});

test("cancels and releases the reader on malformed events, read failures and successful completion", async () => {
  for (const value of [
    "data: {invalid}\n\n",
    frame(completed([message("ok")])),
    null,
  ]) {
    let cancelled = 0;
    let released = 0;
    const reader = {
      read: async () => {
        if (value === null) throw new Error("network interrupted");
        return { value: new TextEncoder().encode(value), done: false };
      },
      cancel: async () => {
        cancelled++;
      },
      releaseLock: () => {
        released++;
      },
    };
    const result = completedText({ body: { getReader: () => reader } });
    if (value?.includes("response.completed")) assert.equal(await result, "ok");
    else await assert.rejects(result);
    assert.equal(cancelled, 1);
    assert.equal(released, 1);
  }
  await assert.rejects(completedText(new Response(null)), {
    code: "interrupted",
  });
});

test("reader cancellation failure does not mask the original stream failure", async () => {
  let released = false;
  const original = new Error("stream disconnected");
  await assert.rejects(
    completedText({
      body: {
        getReader: () => ({
          read: async () => {
            throw original;
          },
          cancel: async () => {
            throw new Error("already closed");
          },
          releaseLock: () => {
            released = true;
          },
        }),
      },
    }),
    (error) => error === original,
  );
  assert.equal(released, true);
});
