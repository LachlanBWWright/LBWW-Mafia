import { describe, expect, it, vi } from "vitest";
const store = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));
vi.mock("expo-secure-store", () => store);
import { persistAuthToken, restoreAuthToken } from "./authStorage";
describe("native credential storage", () => {
  it("serializes sign-in and sign-out writes", async () => {
    const login = persistAuthToken("token");
    const logout = persistAuthToken(null);
    await Promise.all([login, logout]);
    expect(store.setItemAsync).toHaveBeenCalledWith("lbww-auth-token", "token");
    expect(store.deleteItemAsync).toHaveBeenCalledWith("lbww-auth-token");
    expect(store.setItemAsync.mock.invocationCallOrder[0]).toBeLessThan(
      store.deleteItemAsync.mock.invocationCallOrder[0]!,
    );
  });
  it("does not restore a session after sign-out happens during startup", async () => {
    let resolve!: (token: string) => void;
    store.getItemAsync.mockReturnValueOnce(
      new Promise<string>((complete) => {
        resolve = complete;
      }),
    );
    const apply = vi.fn();
    const restoring = restoreAuthToken(apply);
    await persistAuthToken(null);
    resolve("old-token");
    await restoring;
    expect(apply).not.toHaveBeenCalled();
  });
});
