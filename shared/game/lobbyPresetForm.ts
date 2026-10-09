import { initialRoleForms, type LobbyConfig } from "./lobbyConfig";
export function lobbyPresetForm(config: LobbyConfig) {
  const roles = initialRoleForms();
  for (const rule of config.roleSelection.roles)
    roles[rule.role] = {
      enabled: true,
      weight: String(rule.weight),
      minimum: String(rule.minimum),
      maximum: rule.maximum === undefined ? "" : String(rule.maximum),
      tier: rule.tier === undefined ? "" : String(rule.tier),
    };
  return {
    size: String(config.size),
    algorithm: config.roleSelection.algorithm,
    roles,
    slots: config.roleSelection.explicitSlots.join(", "),
  };
}
