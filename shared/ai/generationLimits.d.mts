import type { Generate, TextGenerationProvider } from "./generation.mjs";
export type GenerationLimits = {
  maxConcurrentRequests?: number;
  maxQueuedRequests?: number;
  /** Attempt budget includes failures; explicit retry does not replenish it. */
  maxRequests?: number;
  timeoutMs?: number;
  maxOutputTokens?: number;
};
export function createGenerationLimiter(
  generate: Generate,
  limits?: GenerationLimits,
): {
  generate: Generate;
  retry(): void;
  close(): void;
};
export function withProviderLimits<T extends TextGenerationProvider>(
  provider: T,
  limits?: GenerationLimits,
): T & { retry(): void; close(): void };
