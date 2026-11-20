import { describe, expect, it } from "vitest";
import { checkRoleBalance } from "./balanceCheck.js";

describe("preliminary role balance check", () => {
  it("compares the presence of a role within player counts and retains the current value", () => {
    const report = checkRoleBalance([
      { roles: ["doctor", "mafia"], winner: "town" },
      { roles: ["doctor", "mafia"], winner: "mafia" },
      { roles: ["judge", "mafia"], winner: "mafia" },
      { roles: ["doctor", "judge", "mafia"], winner: "town" },
    ]).find((entry) => entry.role === "doctor");
    expect(report?.currentPower).toBe(5);
    expect(report?.matches).toBe(3);
    expect(report?.comparableMatches).toBe(2);
    expect(report?.townWinRateDifference).toBe(0.5);
    expect(report?.strata[1]?.withoutRole).toBe(0);
  });

  it("does not infer an effect without comparison games and rejects unknown roles", () => {
    expect(checkRoleBalance([{ roles: ["doctor", "mafia"], winner: "town" }]).find((r) => r.role === "doctor")?.townWinRateDifference).toBeNull();
    expect(() => checkRoleBalance([{ roles: ["missing", "mafia"], winner: "town" }])).toThrow();
  });
});
