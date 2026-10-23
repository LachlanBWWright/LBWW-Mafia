/** A lookup identity also owns replay and balance state in the history screen. */
export function recentMatchIdentity(username: string, currentUser: boolean) {
  return JSON.stringify(
    currentUser ? ["current"] : ["username", username.trim()],
  );
}

/** Cancel transport where supported, and ignore results even if it ignores abort. */
export function startHistoryRequest<T>(
  request: (signal: AbortSignal) => Promise<T>,
  onSuccess: (result: T) => void,
  onError: (message: string) => void,
  fallbackMessage: string,
  onSettled?: () => void,
) {
  const controller = new AbortController();
  void resolveHistoryRequest(
    controller.signal,
    request,
    onSuccess,
    onError,
    fallbackMessage,
    onSettled,
  );
  return () => controller.abort();
}

async function resolveHistoryRequest<T>(
  signal: AbortSignal,
  request: (signal: AbortSignal) => Promise<T>,
  onSuccess: (result: T) => void,
  onError: (message: string) => void,
  fallbackMessage: string,
  onSettled?: () => void,
) {
  try {
    const result = await request(signal);
    if (!signal.aborted) onSuccess(result);
  } catch (error: unknown) {
    if (!signal.aborted)
      onError(error instanceof Error ? error.message : fallbackMessage);
  } finally {
    if (!signal.aborted) onSettled?.();
  }
}
