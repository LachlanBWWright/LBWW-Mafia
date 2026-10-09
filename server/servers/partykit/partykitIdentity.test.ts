import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyPartykitGameIdentity } from "./partykitIdentity.js";

function createTicket(payload: Record<string, unknown>, secret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
}

describe("verifyPartykitGameIdentity", () => {
  it("accepts a valid, unexpired identity ticket", async () => {
    const result = await verifyPartykitGameIdentity(
      createTicket(
        { userId: "user-1", handle: "MafiaFan", exp: Date.now() + 60_000 },
        "secret",
      ),
      "secret",
    );

    expect(result).toEqual({ userId: "user-1", handle: "MafiaFan" });
  });

  it.each([
    ["missing token", undefined, "secret"],
    ["missing secret", "token", undefined],
    ["tampered signature", `${createTicket({ userId: "user-1", exp: Date.now() + 60_000 }, "secret")}x`, "secret"],
    ["expired ticket", createTicket({ userId: "user-1", exp: Date.now() - 1 }, "secret"), "secret"],
  ])("rejects %s", async (_label, token, secret) => {
    await expect(
      verifyPartykitGameIdentity(token, secret),
    ).resolves.toBeUndefined();
  });

  it("ignores malformed payloads and non-string identity fields", async () => {
    const result = await verifyPartykitGameIdentity(
      createTicket(
        { userId: 42, handle: 99, exp: Date.now() + 60_000 },
        "secret",
      ),
      "secret",
    );

    expect(result).toBeUndefined();
  });
});
