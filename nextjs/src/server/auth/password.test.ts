import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("uses a unique salted scrypt hash and verifies only the matching password", async () => {
    const first = await hashPassword("correct horse battery staple");
    const second = await hashPassword("correct horse battery staple");

    expect(first).toMatch(/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
    expect(second).not.toBe(first);
    await expect(
      verifyPassword("correct horse battery staple", first),
    ).resolves.toBe(true);
    await expect(verifyPassword("wrong password", first)).resolves.toBe(false);
  });

  it.each([
    "",
    "bcrypt:salt:hash",
    "scrypt::hash",
    `scrypt:${"a".repeat(32)}:not-hex`,
    `scrypt:${"a".repeat(32)}:${"a".repeat(130)}`,
  ])("rejects malformed stored hashes: %s", async (stored) => {
    await expect(verifyPassword("password", stored)).resolves.toBe(false);
  });
});
