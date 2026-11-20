import { expect, it } from "vitest";
import { visitActionIcon } from "./actionIcon";

it("chooses action icons from the same phase and role as the action label", () => {
  expect(visitActionIcon("Doctor", "Night")).toBe("protect");
  expect(visitActionIcon("Investigator", "Night")).toBe("investigate");
  expect(visitActionIcon("Doctor", "Day")).toBe("visit");
});
