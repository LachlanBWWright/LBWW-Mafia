import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyPartyServerGameIdentity } from "./partyserverIdentity.js";

function createTicket(payload: Record<string, unknown>, secret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
}

describe("verifyPartyServerGameIdentity", () => {
  it("accepts a valid, unexpired identity ticket", async () => {
    const result = await verifyPartyServerGameIdentity(
      createTicket(
        { userId: "user-1", handle: "MafiaFan", exp: Date.now() + 60_000 },
        "secret",
      ),
      "secret",
    );

    expect(result).toEqual({ userId: "user-1", handle: "MafiaFan" });
  });

  it("preserves the signed bot-seat claim", async () => {
    const result = await verifyPartyServerGameIdentity(
      createTicket(
        { userId: "user-1", handle: "MafiaFan", botSeat: true, exp: Date.now() + 60_000 },
        "secret",
      ),
      "secret",
    );

    expect(result).toEqual({ userId: "user-1", handle: "MafiaFan", botSeat: true });
  });

  it("identifies signed guest AI seats without inventing an account", async () => {
    const result = await verifyPartyServerGameIdentity(createTicket({ guest: true, botSeat: true, exp: Date.now() + 60_000 }, "secret"), "secret");
    expect(result).toEqual({ userId: undefined, handle: undefined, botSeat: true });
  });

  it.each([
    ["missing token", undefined, "secret"],
    ["missing secret", "token", undefined],
    ["tampered signature", `${createTicket({ userId: "user-1", exp: Date.now() + 60_000 }, "secret")}x`, "secret"],
    ["expired ticket", createTicket({ userId: "user-1", exp: Date.now() - 1 }, "secret"), "secret"],
  ])("rejects %s", async (_label, token, secret) => {
    await expect(
      verifyPartyServerGameIdentity(token, secret),
    ).resolves.toBeUndefined();
  });

  it("ignores malformed payloads and non-string identity fields", async () => {
    const result = await verifyPartyServerGameIdentity(
      createTicket(
        { userId: 42, handle: 99, exp: Date.now() + 60_000 },
        "secret",
      ),
      "secret",
    );

    expect(result).toBeUndefined();
  });
});

describe("game identity ticket framing", () => {
  it.each([
    ["extra token segment", () => `${createTicket({ userId: "user-1", exp: Date.now() + 60_000 }, "secret")}.ignored`],
    ["malformed base64", () => "not-valid-base64.%%%"],
    ["null payload", () => createTicket(null as unknown as Record<string, unknown>, "secret")],
    ["array payload", () => createTicket([] as unknown as Record<string, unknown>, "secret")],
    ["guest without bot seat", () => createTicket({ guest: true, exp: Date.now() + 60_000 }, "secret")],
    ["bot seat without guest or account", () => createTicket({ botSeat: true, exp: Date.now() + 60_000 }, "secret")],
    ["string expiration", () => createTicket({ userId: "user-1", exp: String(Date.now() + 60_000) }, "secret")],
  ])("rejects %s", async (_label, token) => {
    await expect(verifyPartyServerGameIdentity(token(), "secret")).resolves.toBeUndefined();
  });
});
