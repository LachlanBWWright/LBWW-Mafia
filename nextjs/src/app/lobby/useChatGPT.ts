"use client";
import * as React from "react";
import type { ChatGPTClient } from "@mernmafia/shared/game/chatGPTConnection";
import { createNativeChatGPTClient } from "@mernmafia/shared/game/nativeChatGPTConnection";
import { createUseChatGPTConnection } from "@mernmafia/shared/game/useChatGPTConnection";
const useConnection = createUseChatGPTConnection(React);
export function useChatGPT(override?: ChatGPTClient) {
  const client = React.useMemo(
    () =>
      createNativeChatGPTClient((method, body) => {
        if (!window.mafiaDesktop)
          throw new Error(
            "ChatGPT AI characters are available in the desktop and mobile apps.",
          );
        return window.mafiaDesktop.chatGPT(method, body);
      }),
    [],
  );
  return { client: override ?? client, ...useConnection(override ?? client) };
}
