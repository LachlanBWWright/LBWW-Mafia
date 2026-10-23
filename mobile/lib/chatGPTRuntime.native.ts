import { requireOptionalNativeModule } from "expo";
import { fetch as streamingFetch } from "expo/fetch";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { AppState, Platform } from "react-native";
import { z } from "zod";
import { createChatGPTRuntime } from "../../shared/ai/runtime.mjs";
import {
  createBotRunner,
  type BotSocket,
} from "../../shared/ai/partyRunner.mjs";
import {
  createNativeChatGPTClient,
  nativeJoinSchema,
} from "../../shared/game/nativeChatGPTConnection";
import {
  createNativeAuthorization,
  nativeIdentityVerifier,
  type CallbackModule,
} from "./chatGPTAuthorization";

const credentialSchema = z.object({
  clientId: z.string().regex(/^oaiapp_[A-Za-z0-9_-]+$/),
  subject: z.string().optional(),
  email: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().nullable().optional(),
  idToken: z.string().optional(),
  expiresAt: z.number().optional(),
  scopes: z.array(z.string()).optional(),
});
const storageOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const random = () =>
  `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replace(/-/g, "");

class NativeBotSocket implements BotSocket {
  static OPEN = 1;
  private socket: WebSocket;
  get readyState() {
    return this.socket.readyState;
  }
  constructor(url: string) {
    this.socket = new WebSocket(url);
  }
  on(event: string, listener: (data: unknown) => void) {
    this.socket.addEventListener(event, (value) =>
      listener(event === "message" ? (value as MessageEvent).data : value),
    );
  }
  send(data: string) {
    this.socket.send(data);
  }
  close(code = 1000, reason = "Client disconnected") {
    this.socket.close(code, reason);
  }
}

function createClient() {
  const native = requireOptionalNativeModule<CallbackModule>("MafiaChatGPT");
  if (!native)
    return createNativeChatGPTClient(async () => {
      throw new Error(
        "ChatGPT sign-in requires the installed Mafia app. It is unavailable in Expo Go and mobile web.",
      );
    });
  const runtime = createChatGPTRuntime({
    store: {
      async hostId() {
        const saved = await SecureStore.getItemAsync("mafia.chatgpt.host");
        if (saved) return saved;
        const id = `urn:uuid:${Crypto.randomUUID()}`;
        await SecureStore.setItemAsync(
          "mafia.chatgpt.host",
          id,
          storageOptions,
        );
        return id;
      },
      async load() {
        const saved = await SecureStore.getItemAsync(
          "mafia.chatgpt.credentials",
        );
        return saved ? credentialSchema.parse(JSON.parse(saved)) : null;
      },
      async save(value) {
        await SecureStore.setItemAsync(
          "mafia.chatgpt.credentials",
          JSON.stringify(value),
          storageOptions,
        );
      },
    },
    request: streamingFetch as typeof fetch,
    authorizeClient: createNativeAuthorization({
      native,
      random,
      challenge: async (value) =>
        (
          await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            value,
            { encoding: Crypto.CryptoEncoding.BASE64 },
          )
        )
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, ""),
      open: async (url) => {
        if (Platform.OS === "ios") {
          if (!native.open || !(await native.open(url)).ok)
            throw new Error("Could not open ChatGPT sign-in.");
        } else {
          void WebBrowser.openBrowserAsync(url)
            .then((result) => {
              if (result.type === "cancel") runtime.cancelSignIn();
            })
            .catch(() => runtime.cancelSignIn());
        }
      },
    }),
    verifyIdentity: nativeIdentityVerifier(native),
  });
  const runner = createBotRunner({
    WebSocket: NativeBotSocket,
    randomUUID: Crypto.randomUUID,
    generate: (input) => runtime.generate(input),
  });
  const groups = new Set<ReturnType<typeof runner.startBotSeats>>();
  let generation = 0;
  AppState.addEventListener("change", (state) =>
    runner.setPaused(state !== "active"),
  );
  return createNativeChatGPTClient(async (method, body) => {
    if (method === "status") return runtime.connection();
    if (method === "connect") {
      await runtime.startSignIn();
      return {};
    }
    if (method === "models") return runtime.models();
    if (method === "cancel") {
      runtime.cancelSignIn();
      return {};
    }
    if (method === "retry") {
      runtime.retryUsage();
      return {};
    }
    if (method === "disconnect") {
      generation += 1;
      for (const group of groups) group.stop();
      groups.clear();
      return runtime.signOut();
    }
    const expectedGeneration = generation;
    const value = nativeJoinSchema.parse(body);
    const expected = new URL(
      process.env.EXPO_PUBLIC_SOCKET_URL ?? "http://localhost:1999",
    ).origin;
    const socket = new URL(value.socketUrl);
    if (
      socket.origin !== expected ||
      socket.username ||
      socket.password ||
      socket.search ||
      socket.hash ||
      socket.pathname !== "/" ||
      !["http:", "https:"].includes(socket.protocol)
    )
      throw new Error("Invalid game server address.");
    const account = await runtime.connection();
    if (!account.connected || !account.planEnabled || account.usagePaused)
      throw new Error("Connect your ChatGPT plan before adding characters.");
    if (!(await runtime.models()).some((model) => model.slug === value.model))
      throw new Error("Choose an available ChatGPT model.");
    if (generation !== expectedGeneration)
      throw new Error("The ChatGPT connection changed. Try again.");
    const group = runner.startBotSeats({
      ...value,
      url: socket.origin,
      captcha: "",
    });
    groups.add(group);
    return { added: group.length };
  });
}
let client: ReturnType<typeof createClient> | undefined;
export const getNativeChatGPTClient = () => (client ??= createClient());
