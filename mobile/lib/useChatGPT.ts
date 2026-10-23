import * as React from "react";
import type { ChatGPTClient } from "../../shared/game/chatGPTConnection";
import { createUseChatGPTConnection } from "../../shared/game/useChatGPTConnection";
import { getNativeChatGPTClient } from "./chatGPTRuntime";
const useConnection = createUseChatGPTConnection(React);
export function useChatGPT(override?: ChatGPTClient) {
  const client = React.useMemo(
    () => override ?? getNativeChatGPTClient(),
    [override],
  );
  return { client, ...useConnection(client) };
}
