import {
  createApiProvider,
  ApiProviderError,
  defaultApiProviderRegistry,
} from "../../../shared/ai/provider.mjs";
import { createProviderBotRuntime } from "../provider-runtime.mjs";
export { createProviderBotRuntime } from "../provider-runtime.mjs";

/** Environment configuration is consumed only by a trusted Node host, never sent to players. */
export function apiConfigFromEnvironment(
  env = process.env,
  { registry = defaultApiProviderRegistry } = {},
) {
  const provider = env.MAFIA_AI_PROVIDER;
  if (!provider)
    throw new ApiProviderError(
      "configuration",
      "Set MAFIA_AI_PROVIDER to a registered provider ID.",
    );
  const adapter = registry.get(provider);
  const keyName = adapter.apiKeyEnv;
  if (!env.MAFIA_AI_MODEL || (keyName && !env[keyName]))
    throw new ApiProviderError(
      "configuration",
      "Configure an API model and API key.",
    );
  const numeric = (name) =>
    env[name] === undefined ? undefined : Number(env[name]);
  return {
    provider,
    model: env.MAFIA_AI_MODEL,
    apiKey: keyName ? env[keyName] : undefined,
    baseUrl: env.MAFIA_AI_BASE_URL,
    maxOutputTokens: numeric("MAFIA_AI_MAX_OUTPUT_TOKENS"),
    timeoutMs: numeric("MAFIA_AI_TIMEOUT_MS"),
    maxConcurrentRequests: numeric("MAFIA_AI_MAX_CONCURRENT_REQUESTS"),
    maxQueuedRequests: numeric("MAFIA_AI_MAX_QUEUED_REQUESTS"),
    maxRequests: numeric("MAFIA_AI_MAX_REQUESTS"),
  };
}

/** Convenience composition; the bot host itself accepts any TextGenerationProvider. */
export function createApiBotRuntime(config, ports = {}) {
  return createProviderBotRuntime(createApiProvider(config, ports), ports);
}
