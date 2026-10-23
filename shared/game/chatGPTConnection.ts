import { z } from "zod";

export const chatGPTAccountSchema = z.object({
  connected: z.boolean(),
  signingIn: z.boolean(),
  email: z.string().nullable(),
  name: z.string().nullable(),
  planEnabled: z.boolean(),
  usagePaused: z.boolean(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
});
const modelsSchema = z.object({
  models: z.array(
    z.object({ slug: z.string().min(1).max(200), name: z.string() }),
  ),
});
const accountSchema = chatGPTAccountSchema;
export type ChatGPTAccount = z.infer<typeof accountSchema>;
export type ChatGPTModel = z.infer<typeof modelsSchema>["models"][number];
export const chatGPTUsageUrl = "https://chatgpt.com/settings/usage";
export const disconnectedChatGPTAccount: ChatGPTAccount = {
  connected: false,
  signingIn: false,
  email: null,
  name: null,
  planEnabled: false,
  usagePaused: false,
  error: null,
};

type Ports = {
  baseUrl: string;
  origin: string;
  random: () => string;
  challenge: (verifier: string) => Promise<string>;
  request?: typeof fetch;
  pause?: (signal: AbortSignal) => Promise<void>;
};
const wait = (signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(new Error("Connection cancelled."));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, 800);
    signal.addEventListener("abort", abort, { once: true });
  });

export function createChatGPTClient(ports: Ports) {
  let token: string | null = null;
  let accessPending: Promise<void> | null = null;
  const request = ports.request ?? fetch;
  const pause = ports.pause ?? wait;
  async function send(
    path: string,
    body: unknown,
    signal: AbortSignal,
    authenticated = true,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await request(`${ports.baseUrl.replace(/\/$/, "")}${path}`, {
        method: body === undefined ? "GET" : "POST",
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
        headers: {
          "X-Mafia-Client": "1",
          "X-Mafia-Origin": ports.origin,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(authenticated && token ? { "X-Mafia-Session": token } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      if (signal.aborted) throw new Error("Connection cancelled.");
      throw new Error(
        "ChatGPT connection is unavailable. Start the local game launcher and try again.",
      );
    }
    const value: unknown = await response.json();
    if (!response.ok) {
      if (response.status === 401) token = null;
      const error = z.object({ error: z.string().max(500) }).safeParse(value);
      throw new Error(
        error.success
          ? error.data.error
          : "Could not connect to ChatGPT. Try again.",
      );
    }
    return value;
  }
  async function access(signal: AbortSignal, onApproval?: () => void) {
    if (token) return;
    if (!accessPending)
      accessPending = (async () => {
        const verifier = ports.random();
        const start = z
          .object({ id: z.string(), needsApproval: z.boolean() })
          .parse(
            await send(
              "/access/start",
              { challenge: await ports.challenge(verifier) },
              signal,
              false,
            ),
          );
        if (start.needsApproval) onApproval?.();
        const expiry = Date.now() + 180_000;
        for (;;) {
          const result = z
            .union([
              z.object({ token: z.string().min(32) }),
              z.object({ pending: z.literal(true) }),
            ])
            .parse(
              await send(
                "/access/finish",
                { id: start.id, verifier },
                signal,
                false,
              ),
            );
          if ("token" in result) {
            token = result.token;
            return;
          }
          if (Date.now() >= expiry)
            throw new Error("Connection approval expired. Try again.");
          await pause(signal);
        }
      })().finally(() => {
        accessPending = null;
      });
    await accessPending;
  }
  const client = {
    async status(signal: AbortSignal, onApproval?: () => void) {
      await access(signal, onApproval);
      return accountSchema.parse(await send("/connection", undefined, signal));
    },
    async models(signal: AbortSignal) {
      await access(signal);
      return modelsSchema.parse(await send("/models", undefined, signal))
        .models;
    },
    async connect(
      signal: AbortSignal,
      open: (url: string) => void | Promise<void>,
      onCompanion: () => void,
    ) {
      const existing = await client.status(signal, onCompanion);
      if (existing.connected && existing.planEnabled && !existing.signingIn)
        return existing;
      if (!existing.signingIn) {
        const result = z
          .union([
            z.object({ authorizationUrl: z.string().url() }),
            z.object({ onCompanion: z.literal(true) }),
          ])
          .parse(await send("/connect", {}, signal));
        if ("authorizationUrl" in result) {
          const url = new URL(result.authorizationUrl);
          if (
            url.origin !== new URL(ports.baseUrl).origin ||
            url.pathname !== "/authorize" ||
            !/^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get("launch") ?? "")
          )
            throw new Error("Invalid ChatGPT sign-in address.");
          await open(url.href);
        } else onCompanion();
      }
      const expiry = Date.now() + 200_000;
      for (;;) {
        const state = await client.status(signal);
        if (!state.signingIn) {
          if (state.error) throw new Error(state.error.message);
          if (!state.connected)
            throw new Error("ChatGPT sign-in did not complete. Try again.");
          return state;
        }
        if (Date.now() >= expiry)
          throw new Error("ChatGPT sign-in expired. Try again.");
        await pause(signal);
      }
    },
    async cancel(signal: AbortSignal) {
      await access(signal);
      await send("/cancel", {}, signal);
    },
    async disconnect(signal: AbortSignal) {
      await access(signal);
      return z
        .object({ remoteRevocationConfirmed: z.boolean() })
        .parse(await send("/disconnect", {}, signal));
    },
    async retry(signal: AbortSignal) {
      await access(signal);
      await send("/retry", {}, signal);
    },
    async join(
      body: {
        socketUrl: string;
        room: string;
        tickets: string[];
        model: string;
        mode: string;
        personality: string;
        difficulty: string;
      },
      signal: AbortSignal,
    ) {
      await access(signal);
      return z
        .object({ added: z.number().int().nonnegative() })
        .parse(await send("/join", body, signal));
    },
  };
  return client;
}
export type ChatGPTClient = ReturnType<typeof createChatGPTClient>;
