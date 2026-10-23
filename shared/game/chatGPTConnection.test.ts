import { describe, expect, it, vi } from "vitest";
import {
  createChatGPTClient,
  disconnectedChatGPTAccount,
} from "./chatGPTConnection";

function fixture(planDisabled = false) {
  const calls: { path: string; init: RequestInit }[] = [];
  let connected = planDisabled;
  let planEnabled = false;
  let malicious = false;
  let planError = false;
  const open = vi.fn();
  const request = vi.fn(
    async (url: string | URL | Request, init: RequestInit = {}) => {
      const path = new URL(String(url)).pathname;
      calls.push({ path, init });
      if (path === "/access/start")
        return Response.json({ id: "session", needsApproval: false });
      if (path === "/access/finish")
        return Response.json({ token: "local-session-".repeat(4) });
      if (path === "/connection")
        return Response.json({
          ...disconnectedChatGPTAccount,
          connected,
          planEnabled,
        });
      if (path === "/connect") {
        connected = true;
        planEnabled = true;
        return Response.json({
          authorizationUrl: malicious
            ? "https://evil.invalid/steal"
            : "http://127.0.0.1:43117/authorize?launch=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        });
      }
      if (path === "/models")
        return planError
          ? Response.json(
              { error: "ChatGPT plan usage limit reached." },
              { status: 429 },
            )
          : Response.json({
              models: [{ slug: "available", name: "Available" }],
            });
      if (path === "/disconnect")
        return Response.json({ remoteRevocationConfirmed: false });
      return Response.json({ error: "unexpected" }, { status: 400 });
    },
  );
  const client = createChatGPTClient({
    baseUrl: "http://127.0.0.1:43117",
    origin: "http://localhost:3000",
    request: request as typeof fetch,
    random: () => "verifier",
    challenge: async () => "challenge",
    pause: async () => {},
  });
  return {
    client,
    calls,
    open,
    setMalicious: () => {
      malicious = true;
    },
    setPlanError: () => {
      planError = true;
    },
  };
}

describe("ChatGPT subscription connection", () => {
  it("reauthorizes a signed-in account when plan permission is disabled", async () => {
    const { client, calls, open } = fixture(true);
    await expect(
      client.connect(new AbortController().signal, open, vi.fn()),
    ).resolves.toMatchObject({
      connected: true,
      planEnabled: true,
    });
    expect(calls.some(({ path }) => path === "/connect")).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
  });
  it("bootstraps access automatically and opens approved ChatGPT sign-in without user keys", async () => {
    const { client, calls, open } = fixture();
    const signal = new AbortController().signal;
    await expect(client.connect(signal, open, vi.fn())).resolves.toMatchObject({
      connected: true,
    });
    expect(open).toHaveBeenCalledWith(
      "http://127.0.0.1:43117/authorize?launch=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    await expect(client.models(signal)).resolves.toEqual([
      { slug: "available", name: "Available" },
    ]);
    expect(calls.filter(({ path }) => path === "/access/start")).toHaveLength(
      1,
    );
    const headers = new Headers(
      calls.find(({ path }) => path === "/models")!.init.headers,
    );
    expect(headers.get("X-Mafia-Session")).toBeTruthy();
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.has("X-Mafia-Bot-Key")).toBe(false);
  });
  it("never navigates to an untrusted authorization URL", async () => {
    const { client, open, setMalicious } = fixture();
    setMalicious();
    await expect(
      client.connect(new AbortController().signal, open, vi.fn()),
    ).rejects.toThrow("Invalid ChatGPT sign-in address.");
    expect(open).not.toHaveBeenCalled();
  });
  it("surfaces plan limits without switching to API billing", async () => {
    const { client, calls, setPlanError } = fixture();
    setPlanError();
    await expect(client.models(new AbortController().signal)).rejects.toThrow(
      "ChatGPT plan usage limit reached.",
    );
    expect(calls.every(({ path }) => !path.includes("api-key"))).toBe(true);
  });
  it("reports when remote revocation is unconfirmed", async () => {
    const { client } = fixture();
    await expect(
      client.disconnect(new AbortController().signal),
    ).resolves.toEqual({ remoteRevocationConfirmed: false });
  });
});
