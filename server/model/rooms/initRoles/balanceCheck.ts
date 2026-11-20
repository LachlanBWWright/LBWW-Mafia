import { builtInRoleDefinitions } from "../../roles/composition/catalog.js";

/** A completed, comparable normal game, with its original role IDs. */
export type BalanceObservation = {
  roles: string[];
  winner: "town" | "mafia";
};

/**
 * Preliminary descriptive check. Matches are grouped by player count, then
 * compared with games of the same size without the role. This is not a causal
 * estimate: the rest of the roster, player skill, and selection all matter.
 */
export function checkRoleBalance(observations: BalanceObservation[]) {
  const definitions = builtInRoleDefinitions.filter((r) => r.id !== "blank-role");
  const known = new Set(definitions.map((r) => r.id));
  for (const game of observations) {
    if (
      !game || !Array.isArray(game.roles) || game.roles.length < 2 ||
      game.roles.some((role) => typeof role !== "string" || !known.has(role)) ||
      (game.winner !== "town" && game.winner !== "mafia")
    ) throw new Error("Each game must have at least two known role IDs and a town or mafia winner.");
  }

  return definitions.map((definition) => {
    const withRole = observations.filter((game) => game.roles.includes(definition.id));
    const strata = [...new Set(withRole.map((game) => game.roles.length))].map((size) => {
      const present = withRole.filter((game) => game.roles.length === size);
      const absent = observations.filter((game) => game.roles.length === size && !game.roles.includes(definition.id));
      return {
        players: size,
        withRole: present.length,
        townWinsWithRole: present.filter((game) => game.winner === "town").length,
        withoutRole: absent.length,
        townWinsWithoutRole: absent.filter((game) => game.winner === "town").length,
      };
    }).sort((a, b) => a.players - b.players);
    const comparable = strata.filter((s) => s.withoutRole > 0);
    const weight = comparable.reduce((sum, s) => sum + s.withRole, 0);
    const difference = weight ? comparable.reduce((sum, s) => sum + s.withRole * (s.townWinsWithRole / s.withRole - s.townWinsWithoutRole / s.withoutRole), 0) / weight : null;
    return {
      role: definition.id,
      faction: definition.metadata.group,
      currentPower: definition.balance.power,
      matches: withRole.length,
      comparableMatches: weight,
      townWinRateDifference: difference,
      strata,
    };
  });
}
