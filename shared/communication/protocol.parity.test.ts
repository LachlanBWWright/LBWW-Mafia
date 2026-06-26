import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  partykitServerEnvelopeSchema,
  supabaseClientEnvelopeSchema,
} from "./protocol";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.resolve(
  __dirname,
  "../gameplay-fixtures/protocol/socket-transport.json",
);
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as {
  clientControlMessage: unknown;
  expectedClientControlJson: string;
  serverRoomMessage: unknown;
  expectedServerRoomJson: string;
  serverCallbackMessage: unknown;
  expectedServerCallbackJson: string;
};

describe("protocol parity fixtures", () => {
  it("keeps the Supabase control envelope byte-for-byte stable", () => {
    const parsed = supabaseClientEnvelopeSchema.parse(fixture.clientControlMessage);
    expect(JSON.stringify(parsed)).toBe(fixture.expectedClientControlJson);
  });

  it("keeps server event and callback envelopes byte-for-byte stable", () => {
    const eventEnvelope = partykitServerEnvelopeSchema.parse(
      fixture.serverRoomMessage,
    );
    const callbackEnvelope = partykitServerEnvelopeSchema.parse(
      fixture.serverCallbackMessage,
    );

    expect(JSON.stringify(eventEnvelope)).toBe(fixture.expectedServerRoomJson);
    expect(JSON.stringify(callbackEnvelope)).toBe(
      fixture.expectedServerCallbackJson,
    );
  });
});
