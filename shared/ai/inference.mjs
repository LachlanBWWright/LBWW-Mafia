import { failure, providerError } from "./protocol.mjs";

export async function completedText(response) {
  const reader = response.body?.getReader();
  if (!reader)
    throw failure("interrupted", "ChatGPT response ended before completion.");
  const decoder = new TextDecoder();
  const items = new Map();
  let pending = "";
  let bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      bytes += part.value?.byteLength ?? 0;
      if (bytes > 2_000_000)
        throw failure("too-large", "ChatGPT response was too large.");
      pending += decoder.decode(part.value, { stream: !part.done });
      if (part.done) pending += "\n\n";
      pending = pending.replace(/\r\n/g, "\n");
      let split;
      while ((split = pending.indexOf("\n\n")) >= 0) {
        const frame = pending.slice(0, split);
        pending = pending.slice(split + 2);
        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data || data === "[DONE]") continue;
        const event = JSON.parse(data);
        if (
          event.type === "response.output_item.done" &&
          Number.isInteger(event.output_index)
        )
          items.set(event.output_index, event.item);
        if (event.type === "response.failed" || event.type === "error") {
          const error =
            event.type === "response.failed"
              ? event.response?.error
              : (event.error ?? event);
          if (error?.code)
            throw providerError(
              { error },
              {
                status: response.status,
                requestId: response.headers.get("x-request-id"),
              },
            );
          throw failure(
            "incomplete",
            "ChatGPT could not complete the response. Try again.",
          );
        }
        if (event.type === "response.incomplete")
          throw failure(
            "incomplete",
            "ChatGPT could not complete the response. Try again.",
          );
        if (event.type === "response.completed") {
          const output = event.response?.output?.length
            ? event.response.output
            : [...items.entries()]
                .sort(([a], [b]) => a - b)
                .map(([, item]) => item);
          const content = output
            .filter((item) => item?.type === "message")
            .flatMap((item) => item.content ?? []);
          if (content.some((item) => item.type === "refusal"))
            throw failure("refused", "ChatGPT declined this request.");
          const text = content
            .filter(
              (item) =>
                item.type === "output_text" && typeof item.text === "string",
            )
            .map((item) => item.text)
            .join("");
          if (!text.trim())
            throw failure("empty", "ChatGPT returned an empty response.");
          return text;
        }
      }
      if (part.done)
        throw failure(
          "interrupted",
          "ChatGPT response ended before completion.",
        );
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
