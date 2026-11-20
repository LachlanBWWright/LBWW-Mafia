import { expect, it } from "vitest";
import { createGamePackLink, readTransferredGamePack } from "./gamePackTransfer";
import { createCustomRoleDraft } from "../../shared/game/customRoles";
import { createGamePack, exportGamePack } from "../../shared/game/gameCustomization";
const config = { size: 2, roleSelection: { algorithm: "explicit-slots" as const, roles: [], explicitSlots: ["doctor", "mafia"] } };
it("shares portable web links that native import validates and restores", () => {
  const link = createGamePackLink("Friends' night 🎲", config, "https://example.com/");
  const pack = readTransferredGamePack(link);
  expect(pack.name).toBe("Friends' night 🎲");
  expect(pack.config).toEqual(config);
  expect(readTransferredGamePack(exportGamePack(createGamePack("JSON", config))).name).toBe("JSON");
});
it.each(["javascript:alert(1)#pack=hello", "https://example.com/lobby/create", "broken", "https://example.com/#pack=%broken"])("rejects malformed shared content %s", (value) => {
  expect(() => readTransferredGamePack(value)).toThrow();
});

it("preserves custom roles, role slots, private ballots and nested rules in shared links", () => {
  const customRole = createCustomRoleDraft();
  const authoredConfig = {
    size: 2,
    voteVisibility: "hidden" as const,
    customRoles: [customRole],
    roleSelection: { algorithm: "explicit-slots" as const, roles: [], explicitSlots: ["custom:field-medic", "mafia"] },
    rules: { timing: { daySeconds: 120 }, reveal: { onDeath: "none" as const }, communication: { whispers: false }, bots: { fillEmptySeats: true } },
  };
  const imported = readTransferredGamePack(createGamePackLink("Private game", authoredConfig, "https://example.com"));
  expect(imported.config).toEqual(authoredConfig);
});
