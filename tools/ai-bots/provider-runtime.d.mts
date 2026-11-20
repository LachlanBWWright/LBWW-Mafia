import type { GenerationLimits } from "../../shared/ai/generationLimits.mjs";
import type { TextGenerationProvider } from "../../shared/ai/generation.mjs";
import type {
  BotOptions,
  createBotRunner,
} from "../../shared/ai/partyRunner.mjs";
type RunnerPorts = Parameters<typeof createBotRunner>[0];
export type ProviderBotPorts = Pick<
  RunnerPorts,
  "WebSocket" | "randomUUID" | "report"
>;
export function createProviderBotRuntime(
  provider: TextGenerationProvider,
  ports?: Partial<ProviderBotPorts> & { limits?: GenerationLimits },
): {
  startBotSeats(
    options: Omit<BotOptions, "model" | "captcha"> & {
      model?: string;
      captcha?: string;
    },
  ): ReturnType<ReturnType<typeof createBotRunner>["startBotSeats"]>;
  retry(): void;
  setPaused(value: boolean): void;
  close(): void;
};
