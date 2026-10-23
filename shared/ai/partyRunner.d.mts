import type { GenerateInput } from "./runtime.mjs";
export type BotOptions = {
  url: string;
  room: string;
  tickets: string[];
  captcha: string;
  model: string;
  mode: string;
  personality?: string;
  difficulty?: string;
};
export type BotSocket = {
  readyState: number;
  on(event: string, listener: (data: unknown) => void): void;
  send(data: string): void;
  close(code?: number, reason?: string): void;
};
export function createBotRunner(ports: {
  WebSocket: { new (url: string): BotSocket; OPEN: number };
  randomUUID(): string;
  generate(input: GenerateInput): Promise<string>;
  report?(message: string): void;
}): {
  setPaused(value: boolean): void;
  startBotSeats(
    options: BotOptions,
  ): Array<{ close(): void }> & { stop(): void };
};
