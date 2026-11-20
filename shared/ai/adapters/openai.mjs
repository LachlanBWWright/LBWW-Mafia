import { fail } from "../providerError.mjs";
import { apiKeyFor, officialEndpoint } from "./configuration.mjs";

export const adapter = {
  id: "openai",
  apiKeyEnv: "OPENAI_API_KEY",
  create(config) {
    officialEndpoint(config);
    const headers = { Authorization: "Bearer " + apiKeyFor(config) };
    return {
      url: "https://api.openai.com/v1/responses",
      headers,
      encode: ({ model, instructions, messages, maxOutputTokens }) => ({
        model,
        instructions,
        input: messages,
        max_output_tokens: maxOutputTokens,
        store: false,
        stream: false,
      }),
      decode(body) {
        let blocks;

        if (body?.status !== "completed")
          throw fail("incomplete", "The API response did not complete.");
        const output = body.output;
        if (
          !Array.isArray(output) ||
          output.some(
            (item) => item?.type !== "message" && item?.type !== "reasoning",
          )
        )
          throw fail(
            "invalid-response",
            "The API returned an unsupported response.",
          );
        const messages = output.filter((item) => item?.type === "message");
        if (
          messages.some(
            (item) =>
              item.status !== "completed" ||
              item.role !== "assistant" ||
              !Array.isArray(item.content),
          )
        )
          throw fail("incomplete", "The API response did not complete.");
        blocks = messages.flatMap((item) => item.content);
        if (blocks.some((block) => block?.type === "refusal"))
          throw fail("refused", "The API declined the bot decision.");
        if (
          blocks.some(
            (block) =>
              block?.type !== "output_text" || typeof block.text !== "string",
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
