import { createNativeChatGPTClient } from "../../shared/game/nativeChatGPTConnection";
const client = createNativeChatGPTClient(async () => {
  throw new Error(
    "ChatGPT AI characters are available in the installed desktop and mobile apps.",
  );
});
export const getNativeChatGPTClient = () => client;
