import { withProviderLimits } from "./generationLimits.mjs";
import { ApiProviderError, fail } from "./providerError.mjs";
import { createProviderRegistry } from "./providerRegistry.mjs";
import { builtinApiAdapters } from "./adapters/index.mjs";
export { ApiProviderError } from "./providerError.mjs";
export { createProviderRegistry } from "./providerRegistry.mjs";
export { builtinApiAdapters } from "./adapters/index.mjs";
export const defaultApiProviderRegistry =
  createProviderRegistry(builtinApiAdapters);

const MAX_INPUT_CHARACTERS = 128_000;
const MAX_RESPONSE_BYTES = 1_048_576;

function integer(value, fallback, maximum, name) {
  value ??= fallback;
  if (!Number.isInteger(value) || value < 1 || value > maximum)
    throw fail("configuration", `Invalid API provider ${name}.`);
  return value;
}
function validateEndpoint(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw fail("configuration", "Invalid API provider endpoint.");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw fail(
      "configuration",
      "API endpoints require HTTPS (or loopback HTTP), without URL credentials, queries, or fragments.",
    );
  return url.href;
}

function messagesFor(input) {
  if (typeof input === "string" && input.trim())
    return [{ role: "user", content: input }];
  if (
    !Array.isArray(input) ||
    !input.length ||
    input.some(
      (message) =>
        !["user", "assistant"].includes(message?.role) ||
        typeof message.content !== "string" ||
        !message.content.trim(),
    )
  )
    throw fail(
      "configuration",
      "Bot generation requires text user/assistant messages.",
    );
  return input.map(({ role, content }) => ({ role, content }));
}
async function readJson(response, signal) {
  if (!response.body)
    throw fail("invalid-response", "The API returned no response body.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0,
    text = "";
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES)
        throw fail("too-large", "The API response exceeded the size limit.");
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    try {
      return JSON.parse(text);
    } catch {
      throw fail("invalid-response", "The API returned invalid JSON.");
    }
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Trusted-runtime adapter. Never construct this in a web renderer with an API key. */
export function createApiProvider(
  config,
  {
    request = fetch,
    onUsage = () => {},
    registry = defaultApiProviderRegistry,
  } = {},
) {
  const { provider, model } = config;
  if (typeof model !== "string" || !model.trim() || model.length > 200)
    throw fail("configuration", "Configure a generation model.");
  const codec = registry.get(provider).create(config);
  if (
    !codec ||
    typeof codec.encode !== "function" ||
    typeof codec.decode !== "function"
  )
    throw fail(
      "configuration",
      "An HTTP provider adapter must implement encode and decode.",
    );
  const endpoint = validateEndpoint(codec.url);
  const headers = { "Content-Type": "application/json", ...codec.headers };
  const maxTokens = integer(
    config.maxOutputTokens,
    2048,
    65_536,
    "output token limit",
  );
  return withProviderLimits(
    {
      id: provider,
      provider,
      model,
      async generate(input) {
        if (
          input?.model !== model ||
          (input.instructions !== undefined &&
            typeof input.instructions !== "string")
        )
          throw fail(
            "configuration",
            "Bot generation must use the configured API model.",
          );
        const messages = messagesFor(input.input);
        if (
          (input.instructions?.length ?? 0) +
            messages.reduce(
              (size, message) => size + message.content.length,
              0,
            ) >
          MAX_INPUT_CHARACTERS
        )
          throw fail("too-large", "The bot prompt exceeded the size limit.");
        if (input.signal?.aborted)
          throw fail("cancelled", "The API request was cancelled.");
        const signal = input.signal;
        const body = codec.encode({
          model,
          instructions: input.instructions,
          messages,
          maxOutputTokens: Math.min(
            maxTokens,
            input.maxOutputTokens ?? maxTokens,
          ),
        });
        try {
          const response = await request(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal,
            redirect: "error",
          });
          if (!response.ok) {
            await response.body?.cancel().catch(() => {});
            const status = response.status;
            // Do not forward arbitrary provider bodies (which can contain credentials/prompts) to logs.
            if (status === 401 || status === 403) {
              throw fail(
                "authentication",
                "API credentials were rejected. Check the provider configuration.",
                status,
              );
            }
            if (status === 429) {
              throw fail(
                "rate-limit",
                "The API usage or rate limit was reached. Check the provider before retrying.",
                status,
              );
            }
            throw fail(
              status >= 500 ? "unavailable" : "request",
              "The API request failed.",
              status,
            );
          }
          const result = await readJson(response, signal);
          const tokenCount = (value) =>
            Number.isSafeInteger(value) && value >= 0 ? value : null;
          // Accounting is observational; a callback failure must never trigger a duplicate paid request.
          try {
            const usage = codec.usage?.(result);
            Promise.resolve(
              onUsage({
                provider,
                model,
                inputTokens: tokenCount(usage?.inputTokens),
                outputTokens: tokenCount(usage?.outputTokens),
              }),
            ).catch(() => {});
          } catch {
            /* Host owns usage persistence. */
          }
          const text = codec.decode(result);
          if (typeof text !== "string" || !text.trim())
            throw fail(
              "invalid-response",
              "The API returned an empty bot decision.",
            );
          return text;
        } catch (error) {
          if (signal.aborted)
            throw fail("cancelled", "The API request was cancelled.");
          if (error instanceof ApiProviderError) throw error;
          throw fail("unavailable", "The API provider could not be reached.");
        }
      },
    },
    config,
  );
}
