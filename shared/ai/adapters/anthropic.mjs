import { fail } from "../providerError.mjs";
import { apiKeyFor, officialEndpoint } from "./configuration.mjs";

export const adapter = {
  id: "anthropic",
  apiKeyEnv: "ANTHROPIC_API_KEY",
  create(config) {
    officialEndpoint(config);
    const headers = {
      "x-api-key": apiKeyFor(config),
      "anthropic-version": "2023-06-01",
    };
    return {
      url: "https://api.anthropic.com/v1/messages",
      headers,
      encode: ({ model, instructions, messages, maxOutputTokens }) => ({
        model,
        system: instructions,
        messages,
        max_tokens: maxOutputTokens,
        stream: false,
      }),
      decode(body) {
        let blocks;

        if (
          body?.stop_reason === "refusal" ||
          body?.stop_details?.type === "refusal"
        )
          throw fail("refused", "The API declined the bot decision.");
        if (
          body?.type !== "message" ||
          body.role !== "assistant" ||
          body.stop_reason !== "end_turn"
        )
          throw fail("incomplete", "The API response did not complete.");
        blocks = body.content;
        if (
          !Array.isArray(blocks) ||
          blocks.some(
            (block) => block?.type !== "text" || typeof block.text !== "string",
          )
        )
          throw fail(
            "invalid-response",
            "The API returned an unsupported response.",
          );
        const text = blocks.map((block) => block.text).join("");
        if (!text.trim())
          throw fail(
            "invalid-response",
            "The API returned an empty bot decision.",
          );
        return text;
      },
      usage: (body) => ({
        inputTokens: body?.usage?.input_tokens,
        outputTokens: body?.usage?.output_tokens,
      }),
    };
  },
};
