import { withProviderLimits } from "../../shared/ai/generationLimits.mjs";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { ProviderError } from "../../shared/ai/providerError.mjs";
import { createBotRunner } from "../../shared/ai/partyRunner.mjs";

/** Provider-neutral bot host. The supplied provider owns authentication, transport and inference. */
export function createProviderBotRuntime(provider, ports = {}) {
  if (
    !provider ||
    typeof provider.id !== "string" ||
    !provider.id.trim() ||
    typeof provider.model !== "string" ||
    !provider.model.trim() ||
    typeof provider.generate !== "function" ||
    (provider.close !== undefined && typeof provider.close !== "function")
  )
    throw new ProviderError(
      "configuration",
      "Supply a text generation provider with an ID, model, and generate function.",
    );
  provider = withProviderLimits(provider, ports.limits);
  const model = provider.model;
  const runner = createBotRunner({
    WebSocket: ports.WebSocket ?? WebSocket,
    randomUUID: ports.randomUUID ?? randomUUID,
    generate: provider.generate,
    report: ports.report ?? ((message) => process.stderr.write(message)),
  });
  const groups = new Set();
  let closed = false;
  return {
    startBotSeats(options) {
      options ??= {};
      if (closed)
        throw new ProviderError("closed", "The bot runtime is closed.");
      let url;
      try {
        url = new URL(options.url);
      } catch {
        /* validated below */
      }
      if (
        !url ||
        !["https:", "http:", "wss:", "ws:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== "/" ||
        typeof options.room !== "string" ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(options.room) ||
        !Array.isArray(options.tickets) ||
        options.tickets.length < 1 ||
        options.tickets.length > 12 ||
        options.tickets.some(
          (ticket) =>
            typeof ticket !== "string" || !ticket || ticket.length > 8192,
        ) ||
        (options.model !== undefined && options.model !== model) ||
        (options.captcha !== undefined && typeof options.captcha !== "string")
      )
        throw new ProviderError(
          "configuration",
          "Invalid bot seat options. Supply a game origin, room, and 1–12 signed seat tickets.",
        );
      const group = runner.startBotSeats({
        ...options,
        model: model,
        captcha: options.captcha ?? "",
      });
      groups.add(group);
      const stop = group.stop;
      group.stop = () => {
        stop();
        groups.delete(group);
      };
      return group;
    },
    retry() {
      provider.retry();
      runner.retry();
    },
    setPaused(value) {
      runner.setPaused(value);
    },
    close() {
      if (closed) return;
      closed = true;
      for (const group of groups) group.stop();
      provider.close?.();
    },
  };
}
