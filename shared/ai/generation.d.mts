/** The bot engine knows only text generation, never a vendor, wire format, or credential type. */
export type GenerateInput = {
  model: string;
  instructions?: string;
  input: string | { role: string; content: string }[];
  signal?: AbortSignal;
  /** Adapters must honor this maximum when their backend supports output token limits. */
  maxOutputTokens?: number;
};
export type Generate = (input: GenerateInput) => Promise<string>;
export type TextGenerationProvider = {
  readonly id: string;
  readonly model: string;
  generate: Generate;
  /** The runtime owns the provider's lifecycle. Optional for stateless adapters. */
  close?(): void;
  /** Clear backend-specific paused state after an explicit user retry. */
  retry?(): void;
};
