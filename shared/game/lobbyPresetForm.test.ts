import { expect, it } from "vitest";
import { lobbyPresetForm } from "./lobbyPresetForm";
import { lobbyConfigSchema, parseLobbyForm } from "./lobbyConfig";
it("round trips saved explicit and weighted rules through both client forms", () => {
  for (const input of [
    {
      size: 3,
      roleSelection: {
        algorithm: "explicit-slots",
        explicitSlots: ["doctor", "doctor", "mafia"],
      },
    },
    {
      size: 3,
      roleSelection: {
        algorithm: "tier-balanced",
        roles: [
          { role: "doctor", weight: 2, minimum: 1, maximum: 2, tier: 0 },
          { role: "mafia", minimum: 1, maximum: 1, tier: 1 },
        ],
      },
    },
  ]) {
    const config = lobbyConfigSchema.parse(input),
      form = lobbyPresetForm(config);
    expect(
      parseLobbyForm(form.size, form.algorithm, form.roles, form.slots),
    ).toEqual({ success: true, data: config });
  }
});
