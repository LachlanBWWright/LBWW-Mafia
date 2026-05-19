export class PhaseScheduler {
  private readonly scheduledHandles = new Set<ReturnType<typeof setTimeout>>();

  constructor(private readonly shouldIgnoreCallbacks: () => boolean) {}

  schedule(delayMs: number, callback: () => void): void {
    const handle = setTimeout(() => {
      this.scheduledHandles.delete(handle);
      if (this.shouldIgnoreCallbacks()) {
        return;
      }
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
