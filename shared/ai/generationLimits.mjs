import { fail } from "./providerError.mjs";
import { abortable } from "./cancellation.mjs";

const managedFunctions = new WeakMap();
const managedProviders = new WeakSet();
function integer(value, fallback, maximum, label) {
  value ??= fallback;
  if (!Number.isInteger(value) || value < 1 || value > maximum)
    throw fail("configuration", `Invalid generation ${label}.`);
  return value;
}

/** One shared admission policy per provider/runner, independent of its transport. */
export function createGenerationLimiter(generate, limits) {
  if (limits === undefined && managedFunctions.has(generate))
    return managedFunctions.get(generate);
  if (typeof generate !== "function")
    throw fail("configuration", "Supply a generation function.");
  const maxConcurrent = integer(
    limits?.maxConcurrentRequests,
    2,
    12,
    "concurrency limit",
  );
  const maxQueued = integer(limits?.maxQueuedRequests, 24, 1000, "queue limit");
  const maxRequests = integer(
    limits?.maxRequests,
    100,
    100_000,
    "request budget",
  );
  const timeoutMs = integer(limits?.timeoutMs, 30_000, 120_000, "timeout");
  const maxOutputTokens = integer(
    limits?.maxOutputTokens,
    2048,
    65_536,
    "output token limit",
  );
  const controllers = new Set(),
    queue = [];
  let running = 0,
    attempts = 0,
    paused = false,
    closed = false;
  const acquire = (signal) => {
    signal.throwIfAborted();
    if (running < maxConcurrent) {
      running++;
      return Promise.resolve();
    }
    if (queue.length >= maxQueued)
      throw fail("busy", "The generation request queue is full.");
    return new Promise((resolve, reject) => {
      const abort = () => {
        const index = queue.indexOf(waiter);
        if (index !== -1) queue.splice(index, 1);
        reject(signal.reason);
      };
      const waiter = {
        ready() {
          signal.removeEventListener("abort", abort);
          resolve();
        },
      };
      queue.push(waiter);
      signal.addEventListener("abort", abort, { once: true });
    });
  };
  const release = () => {
    running--;
    const next = queue.shift();
    if (next) {
      running++;
      next.ready();
    }
  };
  const check = () => {
    if (closed) throw fail("closed", "The generation provider is closed.");
    if (paused)
      throw fail(
        "paused",
        "The generation provider is paused. Check credentials or limits before retrying.",
      );
    if (attempts >= maxRequests)
      throw fail("budget", "The generation request budget is exhausted.");
  };
  const limiter = {
    retry() {
      if (!closed) paused = false;
    },
    close() {
      if (closed) return;
      closed = true;
      for (const controller of controllers) controller.abort();
    },
    async generate(input) {
      check();
      if (input?.signal?.aborted)
        throw fail("cancelled", "Generation was cancelled.");
      const outputLimit =
        input?.maxOutputTokens === undefined
          ? maxOutputTokens
          : Math.min(
              maxOutputTokens,
              integer(
                input.maxOutputTokens,
                maxOutputTokens,
                65_536,
                "output token limit",
              ),
            );
      const controller = new AbortController();
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = AbortSignal.any([
        controller.signal,
        timeout,
        ...(input?.signal ? [input.signal] : []),
      ]);
      controllers.add(controller);
      let acquired = false;
      try {
        await acquire(signal);
        acquired = true;
        signal.throwIfAborted();
        check();
        attempts++;
        return await abortable(
          () => generate({ ...input, signal, maxOutputTokens: outputLimit }),
          signal,
        );
      } catch (error) {
        if (input?.signal?.aborted || controller.signal.aborted)
          throw fail("cancelled", "Generation was cancelled.");
        if (timeout.aborted) throw fail("timeout", "Generation timed out.");
        if (
          ["authentication", "rate-limit", "usage-limit"].includes(error?.code)
        )
          paused = true;
        throw error;
      } finally {
        controllers.delete(controller);
        if (acquired) release();
      }
    },
  };
  managedFunctions.set(limiter.generate, limiter);
  return limiter;
}

/** Preserve provider methods while adding the same policy to HTTP, SDK and local inference. */
export function withProviderLimits(provider, limits) {
  if (limits === undefined && managedProviders.has(provider)) return provider;
  const limiter = createGenerationLimiter(
    (input) => provider.generate(input),
    limits,
  );
  let closed = false;
  const limited = {
    ...provider,
    id: provider.id,
    model: provider.model,
    generate: limiter.generate,
    retry() {
      if (closed) return;
      provider.retry?.();
      limiter.retry();
    },
    close() {
      if (closed) return;
      closed = true;
      limiter.close();
      provider.close?.();
    },
  };
  managedProviders.add(limited);
  return limited;
}
