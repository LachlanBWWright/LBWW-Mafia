export class ProviderError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}
export const fail = (code, message, status) =>
  new ProviderError(code, message, status);

export { ProviderError as ApiProviderError };
