export class PhaseScheduler {
  private readonly scheduledHandles = new Set<ReturnType<typeof setTimeout>>();

  constructor(private readonly shouldIgnoreCallbacks: () => boolean) {}

  schedule(delayMs: number, callback: () => void): void {
    const deadline = Date.now() + delayMs;
    const handle = setTimeout(() => {
      this.scheduledHandles.delete(handle);
      if (this.shouldIgnoreCallbacks()) {
        return;
      }
      const lateMs = Date.now() - deadline;
      if (lateMs > 1000)
        console.warn(JSON.stringify({ event: "phase.delayed", lateMs }));
      callback();
    }, delayMs);
    this.scheduledHandles.add(handle);
  }

  cancelAll(): void {
    for (const handle of this.scheduledHandles) {
      clearTimeout(handle);
    }
    this.scheduledHandles.clear();
  }
}
