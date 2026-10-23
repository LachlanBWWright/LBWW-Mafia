import type { ChatGPTAccount, ChatGPTModel } from "../game/chatGPTConnection";
export type Credentials = {
  clientId: string;
  subject?: string;
  email?: string | null;
  name?: string | null;
  accessToken?: string;
  refreshToken?: string | null;
  idToken?: string;
  expiresAt?: number;
  scopes?: string[];
};
export type GenerateInput = {
  model: string;
  instructions?: string;
  input: string | { role: string; content: string }[];
};
export type Identity = { sub: string; email?: unknown; name?: unknown };
export type Authorization = {
  authorizationUrl: string;
  nonce: string;
  verifier: string;
  redirectUri: string;
  result: Promise<
    | { code: string; clientId: string; error?: never }
    | { error: Error; code?: never; clientId?: never }
  >;
  cancel(): void;
};
export type RuntimePorts = {
  store: {
    path?: string;
    hostId(): Promise<string>;
    load(): Promise<Credentials | null>;
    save(value: Credentials): Promise<void>;
  };
  request?: typeof fetch;
  now?: () => number;
  authorizeClient(input: {
    hostId: string;
    registration: Credentials | null;
    reconsent: boolean;
  }): Promise<Authorization>;
  verifyIdentity(
    token: string,
    clientId: string,
    nonce: string,
    request: typeof fetch,
    now: number,
  ): Promise<Identity>;
};
export type ChatGPTRuntime = {
  connection(): Promise<ChatGPTAccount>;
  startSignIn(): Promise<{ authorizationUrl: string }>;
  cancelSignIn(): void;
  signOut(): Promise<{ remoteRevocationConfirmed: boolean }>;
  retryUsage(): void;
  models(): Promise<ChatGPTModel[]>;
  generate(input: GenerateInput): Promise<string>;
  close(): void;
};
export function createChatGPTRuntime(ports: RuntimePorts): ChatGPTRuntime;
