import { describe, it, expect } from "vitest";
import {
  makePackDocument,
  makePackLink,
  readPackInput,
} from "./game-pack-actions";
import { createCustomRoleDraft } from "@mernmafia/shared/game/customRoles";
import { lobbyConfigSchema } from "@mernmafia/shared/game/lobbyConfig";
const config = lobbyConfigSchema.parse({
  size: 2,
  voteVisibility: "hidden",
  roleSelection: {
    algorithm: "explicit-slots",
    roles: [],
    explicitSlots: ["custom:field-medic", "mafia"],
  },
  customRoles: [createCustomRoleDraft()],
  rules: { timing: { daySeconds: 90 }, reveal: { onDeath: "none" } },
});
describe("game pack actions", () => {
  it("round-trips rules, custom abilities and roster through JSON", () => {
    const doc = makePackDocument("Medic night", config);
    expect(readPackInput(doc)).toMatchObject({
      version: 1,
      name: "Medic night",
      config,
    });
  });
  it("round-trips an encoded share link without losing special name characters", () => {
    const url = makePackLink(
      "https://example.test",
      "Town & Mafia / 夜",
      config,
    );
    expect(url).toMatch(/^https:\/\/example.test\/lobby\/create#pack=/);
    expect(readPackInput(url)).toMatchObject({
      name: "Town & Mafia / 夜",
      config,
    });
  });
  it("rejects unsupported versions and malformed links", () => {
    expect(() =>
      readPackInput(
        makePackDocument("Test", config).replace(
          '"version": 1',
          '"version": 2',
        ),
      ),
    ).toThrow();
    expect(() => readPackInput("https://example.test/#pack=%zz")).toThrow();
    expect(() => readPackInput("{broken")).toThrow("not valid JSON");
  });
});
