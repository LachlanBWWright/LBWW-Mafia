import { describe, expect, it } from "vitest";
import { RoleHandler } from "./roleHandler";
import { lobbyConfigSchema } from "@mernmafia/shared/game/lobbyConfig";
describe("normal lobby role selection", () => {
  it("uses the same role selection as the default game", () => {
    const config = lobbyConfigSchema.parse({
      size: 8,
      roleSelection: { algorithm: "normal", roles: [], explicitSlots: [] },
    });
    const random = () => 0.5;
    const standard = new RoleHandler(8, [], random).assignGame();
    const custom = new RoleHandler(8, [], random).assignGame(config);
    expect(custom.map((role) => role.id)).toEqual(
      standard.map((role) => role.id),
    );
    expect(custom).toHaveLength(8);
  });
});
