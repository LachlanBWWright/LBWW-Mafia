import type { GenerationLimits } from "./generationLimits.mjs";
import type { TextGenerationProvider } from "./generation.mjs";
export type {
  GenerateInput,
  Generate,
  TextGenerationProvider,
} from "./generation.mjs";
export type ApiProviderId = string;
export { ApiProviderError } from "./providerError.mjs";
export type ApiProviderConfig = GenerationLimits & {
  provider: ApiProviderId;
  model: string;
  apiKey?: string;
  /** Adapter-specific configuration stays opaque to the runtime. */
  options?: Readonly<Record<string, unknown>>;
  /** Only for explicitly selected OpenAI-compatible endpoints; includes /v1 if required. */
  baseUrl?: string;
};
export type ApiUsage = {
  provider: ApiProviderId;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};
/** Register one adapter to add a vendor without modifying transport policy or game code. */
export type HttpProviderAdapter = {
  readonly id: string;
  /** Optional environment credential name for the Node host. No credential is required by the interface. */
  readonly apiKeyEnv?: string;
  create(config: ApiProviderConfig): {
    url: string;
    headers?: Readonly<Record<string, string>>;
    encode(input: {
      model: string;
      instructions?: string;
      messages: { role: string; content: string }[];
      maxOutputTokens: number;
    }): unknown;
    /** Return completed text only; reject truncation, refusal, tool calls and malformed output. */
    decode(body: unknown): string;
    usage?(body: unknown): {
      inputTokens?: number | null;
      outputTokens?: number | null;
    };
  };
};
export type ProviderRegistry = {
  get(id: string): HttpProviderAdapter;
  ids(): string[];
};
export function createProviderRegistry(
  adapters: Iterable<HttpProviderAdapter>,
): ProviderRegistry;
export const builtinApiAdapters: readonly HttpProviderAdapter[];
export const defaultApiProviderRegistry: ProviderRegistry;
export function createApiProvider(
  config: ApiProviderConfig,
  ports?: {
    registry?: ProviderRegistry;
    request?: typeof fetch;
    onUsage?: (usage: ApiUsage) => void | Promise<void>;
  },
): TextGenerationProvider & {
  readonly provider: ApiProviderId;
  readonly model: string;
  /** Resume after an authentication/rate-limit failure; does not replenish the attempt budget. */
  retry(): void;
  close(): void;
};
