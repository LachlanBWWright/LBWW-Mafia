import type { GenerationLimits } from "../../../shared/ai/generationLimits.mjs";
import type {
  ApiProviderConfig,
  ApiUsage,
  ProviderRegistry,
} from "../../../shared/ai/provider.mjs";
import type {
  createProviderBotRuntime,
  ProviderBotPorts,
} from "../provider-runtime.mjs";
export { createProviderBotRuntime } from "../provider-runtime.mjs";
export function apiConfigFromEnvironment(
  env?: Record<string, string | undefined>,
  ports?: { registry?: ProviderRegistry },
): ApiProviderConfig;
export function createApiBotRuntime(
  config: ApiProviderConfig,
  ports?: Partial<ProviderBotPorts> & {
    limits?: GenerationLimits;
    registry?: ProviderRegistry;
    request?: typeof fetch;
    onUsage?: (usage: ApiUsage) => void | Promise<void>;
  },
): ReturnType<typeof createProviderBotRuntime>;
