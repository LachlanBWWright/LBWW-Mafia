import { fail } from "../providerError.mjs";
import { apiKeyFor } from "./configuration.mjs";

export const adapter = {
  id: "openai-compatible",
  apiKeyEnv: "MAFIA_AI_API_KEY",
  create(config) {
    if (typeof config.baseUrl !== "string")
      throw fail(
        "configuration",
        "Choose an API provider and configure its endpoint.",
      );
    const headers = { Authorization: "Bearer " + apiKeyFor(config) };
    return {
      url: config.baseUrl.replace(/\/+$/, "") + "/chat/completions",
      headers,
      encode: ({ model, instructions, messages, maxOutputTokens }) => ({
        model,
        messages: [
          ...(instructions ? [{ role: "system", content: instructions }] : []),
          ...messages,
        ],
        max_tokens: maxOutputTokens,
        stream: false,
      }),
      decode(body) {
        let blocks;

        const choices = body?.choices;
        if (!Array.isArray(choices) || choices.length !== 1)
          throw fail(
            "invalid-response",
            "The API returned an unsupported response.",
          );
        const choice = choices[0];
        if (
          choice?.message?.refusal ||
          choice?.finish_reason === "content_filter"
        )
          throw fail("refused", "The API declined the bot decision.");
        if (
          choice?.finish_reason !== "stop" ||
          choice?.message?.tool_calls?.length ||
          choice?.message?.function_call
        )
          throw fail("incomplete", "The API response did not complete.");
        if (
          choice.message?.role !== "assistant" ||
          typeof choice.message.content !== "string"
        )
          throw fail(
            "invalid-response",
            "The API returned an unsupported response.",
          );
        blocks = [{ text: choice.message.content }];
        const text = blocks.map((block) => block.text).join("");
        if (!text.trim())
          throw fail(
            "invalid-response",
            "The API returned an empty bot decision.",
          );
        return text;
      },
      usage: (body) => ({
        inputTokens: body?.usage?.prompt_tokens,
        outputTokens: body?.usage?.completion_tokens,
      }),
    };
  },
};
