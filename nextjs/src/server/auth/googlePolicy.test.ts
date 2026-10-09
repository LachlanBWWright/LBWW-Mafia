import { describe, expect, it, vi } from "vitest";
vi.mock("next-auth/providers/google", () => ({
  default: (options: object) => ({ id: "google", ...options }),
}));
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("@auth/drizzle-adapter", () => ({ DrizzleAdapter: () => ({}) }));
vi.mock("./identity", () => ({ getActiveIdentity: vi.fn() }));
import { authConfig } from "./config";
describe("Google-only authentication policy", () => {
  it("exposes only Google and does not allow email account linking", () => {
    expect(authConfig.providers.map((provider) => provider.id)).toEqual([
      "google",
    ]);
    expect(authConfig.providers[0]).not.toHaveProperty(
      "allowDangerousEmailAccountLinking",
      true,
    );
  });
  it("requires a verified Google account", () => {
    const check = authConfig.callbacks.signIn;
    expect(
      check({
        account: { provider: "google" },
        profile: { email_verified: true },
      } as Parameters<typeof check>[0]),
    ).toBe(true);
    expect(
      check({
        account: { provider: "google" },
        profile: { email_verified: false },
      } as Parameters<typeof check>[0]),
    ).toBe(false);
    expect(
      check({
        account: { provider: "credentials" },
        profile: { email_verified: true },
      } as Parameters<typeof check>[0]),
    ).toBe(false);
  });
  it("invalidates legacy web credentials sessions", async () => {
    const jwt = authConfig.callbacks.jwt;
    const token = await jwt({
      token: {
        sub: "legacy-password-user",
        name: "Old name",
        email: "old@test.invalid",
        picture: "old.png",
        isAdmin: true,
        handle: "old",
      },
    } as unknown as Parameters<typeof jwt>[0]);
    expect(token.sub).toBeUndefined();
    expect(token.name).toBeUndefined();
    expect(token.email).toBeUndefined();
    expect(token.picture).toBeUndefined();
    expect(token.isAdmin).toBe(false);
    expect(token.handle).toBeNull();
  });
  it("does not expose stale identity or privileges in a revoked session response", () => {
    const callback = authConfig.callbacks.session;
    const result = callback({
      session: {
        user: {
          id: "old",
          name: "Old name",
          email: "old@test.invalid",
          image: "old.png",
        },
        expires: "future",
      },
      token: { isAdmin: true, handle: "old" },
    } as unknown as Parameters<typeof callback>[0]);
    expect(result.user).toMatchObject({
      id: "",
      name: null,
      email: null,
      image: null,
      isAdmin: false,
      handle: null,
    });
  });
});
