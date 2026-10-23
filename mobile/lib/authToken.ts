const listeners = new Set<(value: string | null) => void>();
export function subscribeAuthToken(listener: (value: string | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
let token: string | null = null;
export const getAuthToken = () => token;
export const setAuthToken = (value: string | null) => {
  token = value;
  for (const listener of listeners) listener(value);
};
