import { fail } from "../providerError.mjs";
export function apiKeyFor(config) {
  if (
    typeof config.apiKey !== "string" ||
    !config.apiKey.trim() ||
    /[\r\n]/.test(config.apiKey)
  )
    throw fail("configuration", "Configure an API model and API key.");
  return config.apiKey;
}
export function officialEndpoint(config) {
  if (config.baseUrl !== undefined)
    throw fail(
      "configuration",
      "Custom endpoints require the openai-compatible provider.",
    );
}
