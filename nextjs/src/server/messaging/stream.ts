import type { MessageNotification } from "./events";

type Subscribe = (
  listener: (event: MessageNotification) => void,
) => Promise<() => Promise<unknown> | void>;
/** Cleanup covers request abort, reader cancellation, setup failure, and connection rotation. */
export function createMessageStream(signal: AbortSignal, subscribe: Subscribe) {
  const opened = Date.now();
  console.info(JSON.stringify({ event: "sse.open" }));
  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribe: (() => Promise<unknown> | void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let closeController: (() => void) | undefined;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    console.info(
      JSON.stringify({ event: "sse.close", lifetimeMs: Date.now() - opened }),
    );
    clearInterval(heartbeat);
    clearTimeout(expiry);
    signal.removeEventListener("abort", abort);
    void Promise.resolve(unsubscribe?.()).catch(() => undefined);
  };
  const abort = () => {
    cleanup();
    closeController?.();
  };
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      closeController = () => {
        try {
          controller.close();
        } catch {
          /* Reader already cancelled. */
        }
      };
      const send = (event: string, payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`,
            ),
          );
        } catch {
          cleanup();
        }
      };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) {
        abort();
        return;
      }
      try {
        unsubscribe = await subscribe((message) => send("message", message));
        if (closed) {
          void Promise.resolve(unsubscribe()).catch(() => undefined);
          return;
        }
        send("ready", { ok: true });
        heartbeat = setInterval(
          () => send("heartbeat", { at: Date.now() }),
          25_000,
        );
        expiry = setTimeout(abort, 240_000);
      } catch (error) {
        cleanup();
        controller.error(error);
      }
    },
    cancel() {
      cleanup();
    },
  });
}
