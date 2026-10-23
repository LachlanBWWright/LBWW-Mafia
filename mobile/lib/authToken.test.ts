import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthToken, setAuthToken, subscribeAuthToken } from "./authToken";

afterEach(() => setAuthToken(null));

describe("mobile auth token notifications", () => {
  it("publishes sign-in and sign-out changes to current subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAuthToken(listener);

    setAuthToken("access-token");
    expect(getAuthToken()).toBe("access-token");
    expect(listener).toHaveBeenLastCalledWith("access-token");

    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
    expect(listener).toHaveBeenLastCalledWith(null);

    unsubscribe();
    setAuthToken("later-token");
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
