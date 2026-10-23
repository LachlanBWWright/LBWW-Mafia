import { z } from "zod";
import { chatGPTAccountSchema, type ChatGPTClient } from "./chatGPTConnection";

export type NativeChatGPTMethod =
  | "status"
  | "connect"
  | "models"
  | "cancel"
  | "disconnect"
  | "retry"
  | "join";
export type NativeChatGPTInvoke = (
  method: NativeChatGPTMethod,
  body?: unknown,
) => Promise<unknown>;
export const nativeJoinSchema = z.object({
  socketUrl: z.string().url(),
  room: z.string().trim().min(1).max(128),
  tickets: z.array(z.string().min(1).max(4096)).min(1).max(12),
  model: z.string().min(1).max(200),
  mode: z.enum(["shared", "per-character"]),
  personality: z.enum(["varied", "cautious", "argumentative", "deceptive"]),
  difficulty: z.enum(["casual", "standard", "challenging"]),
});

/** Only status, model metadata and bot seat commands cross the native boundary. */
export function createNativeChatGPTClient(
  invoke: NativeChatGPTInvoke,
): ChatGPTClient {
  const call = async (
    method: NativeChatGPTMethod,
    signal: AbortSignal,
    body?: unknown,
  ) => {
    signal.throwIfAborted();
    const result = await invoke(method, body);
    signal.throwIfAborted();
    return result;
  };
  const status = async (signal: AbortSignal) =>
    chatGPTAccountSchema.parse(await call("status", signal));
  return {
    status,
    models: async (signal) =>
      z
        .array(z.object({ slug: z.string().min(1).max(200), name: z.string() }))
        .parse(await call("models", signal)),
    connect: async (signal) => {
      const cancel = () => {
        void invoke("cancel").catch(() => {});
      };
      signal.addEventListener("abort", cancel, { once: true });
      try {
        let account = await status(signal);
        if (account.connected && account.planEnabled && !account.signingIn)
          return account;
        if (!account.signingIn) await call("connect", signal);
        const deadline = Date.now() + 200_000;
        for (;;) {
          account = await status(signal);
          if (!account.signingIn) {
            if (account.error) throw new Error(account.error.message);
            if (!account.connected)
              throw new Error("ChatGPT sign-in did not complete. Try again.");
            return account;
          }
          if (Date.now() > deadline) {
            cancel();
            throw new Error("ChatGPT sign-in expired. Try again.");
          }
          await new Promise<void>((resolve) => setTimeout(resolve, 500));
        }
      } finally {
        signal.removeEventListener("abort", cancel);
      }
    },
    cancel: async (signal) => {
      await call("cancel", signal);
    },
    disconnect: async (signal) =>
      z
        .object({ remoteRevocationConfirmed: z.boolean() })
        .parse(await call("disconnect", signal)),
    retry: async (signal) => {
      await call("retry", signal);
    },
    join: async (body, signal) =>
      z
        .object({ added: z.number().int().nonnegative() })
        .parse(await call("join", signal, nativeJoinSchema.parse(body))),
  };
}

declare global {
  interface Window {
    mafiaDesktop?: { chatGPT: NativeChatGPTInvoke };
  }
}
