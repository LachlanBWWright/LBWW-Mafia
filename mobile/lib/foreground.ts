import { AppState } from "react-native";
/** Timers stop while backgrounded; resuming sends an immediate update. */
export function runInForeground(callback: () => void, intervalMs: number) {
  let timer: ReturnType<typeof setInterval> | undefined;
  const update = (state: string) => {
    clearInterval(timer);
    timer = undefined;
    if (state === "active") {
      callback();
      timer = setInterval(callback, intervalMs);
    }
  };
  update(AppState.currentState);
  const subscription = AppState.addEventListener("change", update);
  return () => {
    clearInterval(timer);
    subscription.remove();
  };
}
