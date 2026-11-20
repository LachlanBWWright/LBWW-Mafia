export class ProviderError extends Error {
  code:
    | "configuration"
    | "closed"
    | "paused"
    | "budget"
    | "busy"
    | "authentication"
    | "rate-limit"
    | "unavailable"
    | "request"
    | "timeout"
    | "cancelled"
    | "invalid-response"
    | "incomplete"
    | "refused"
    | "too-large";
  status?: number;
  constructor(code: ProviderError["code"], message: string, status?: number);
}
export { ProviderError as ApiProviderError };
export function fail(
  code: ProviderError["code"],
  message: string,
  status?: number,
): ProviderError;
