/** Reject promptly on cancellation even if an adapter settles late; always observe its result. */
export function abortable(operation, signal) {
  if (!signal) return Promise.resolve().then(operation);
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve()
      .then(() => {
        signal.throwIfAborted();
        return operation();
      })
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
