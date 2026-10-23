import {
  disconnectedChatGPTAccount,
  type ChatGPTClient,
} from "../game/chatGPTConnection";

/** Offline connection fixtures; no browser authorization or model requests. */
export function chatGPTFixture(
  state:
    | "disconnected"
    | "connected"
    | "usage-limit"
    | "plan-disabled" = "disconnected",
): ChatGPTClient {
  let connected = state !== "disconnected";
  let paused = state === "usage-limit";
  let planEnabled = connected && state !== "plan-disabled";
  const status = async () => ({
    ...disconnectedChatGPTAccount,
    connected,
    planEnabled,
    email: connected ? "player@example.com" : null,
    usagePaused: paused,
  });
  return {
    status,
    models: async () =>
      connected && planEnabled
        ? [{ slug: "fixture-model", name: "Available model" }]
        : [],
    connect: async () => {
      connected = true;
      planEnabled = true;
      return status();
    },
    disconnect: async () => {
      connected = false;
      return { remoteRevocationConfirmed: true };
    },
    retry: async () => {
      paused = false;
    },
    cancel: async () => {},
    join: async (body) => ({ added: body.tickets.length }),
  };
}
