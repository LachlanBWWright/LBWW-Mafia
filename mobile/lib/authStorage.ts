import * as SecureStore from "expo-secure-store";
const KEY = "lbww-auth-token";
/** Serial writes prevent a slow login write from restoring a signed-out session. */
let writes = Promise.resolve();
let revision = 0;
export async function restoreAuthToken(
  apply: (token: string) => Promise<void> | void,
) {
  const started = revision;
  const token = await SecureStore.getItemAsync(KEY);
  if (token && revision === started) await apply(token);
}
export function persistAuthToken(token: string | null) {
  revision++;
  writes = writes
    .catch(() => undefined)
    .then(() =>
      token
        ? SecureStore.setItemAsync(KEY, token)
        : SecureStore.deleteItemAsync(KEY),
    );
  return writes;
}
