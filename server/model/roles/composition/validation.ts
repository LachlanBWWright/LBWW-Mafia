import { RoleTrait } from "./roleTraits.js";
import { builtInFactionDefinitions } from "../../factions/composition/catalog.js";
import { builtInRoleDefinitions } from "./catalog.js";
import type { RoleDefinition } from "./roleDefinition.js";
import type { FactionDefinition } from "../../factions/composition/factionDefinition.js";

export type ValidationIssue = {
  code: string;
  path: string;
  message: string;
};

const CATEGORY_PATTERN = /^[a-z]+(?:-[a-z]+)*$/;

function getHandlers(definition: RoleDefinition) {
  return typeof definition.handlers === "function"
    ? definition.handlers()
    : definition.handlers;
}

/**
 * Validates composed role and faction catalogs together.
 *
 * @param roles - Role definitions to validate.
 * @param factions - Faction definitions to validate.
 * @returns All validation issues.
 */
export function validateBuiltInCatalogs(
  roles: RoleDefinition[] = builtInRoleDefinitions,
  factions: FactionDefinition[] = builtInFactionDefinitions,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const roleIds = new Set<string>();
  const factionIds = new Set<string>();
  const factionTraits = new Set(
    factions.flatMap((definition) => definition.memberTraits),
  );

  for (const definition of roles) {
    if (roleIds.has(definition.id)) {
      issues.push({
        code: "duplicate-role-id",
        path: `roles.${definition.id}.id`,
        message: `Duplicate role id "${definition.id}".`,
      });
    }
    roleIds.add(definition.id);

    const metadataEntries = [
      ["name", definition.metadata.name],
      ["category", definition.metadata.category],
      ["summary", definition.metadata.summary],
      ["description", definition.metadata.description],
    ] as const;
    for (const [field, value] of metadataEntries) {
      if (value.trim().length === 0) {
        issues.push({
          code: "empty-role-metadata",
          path: `roles.${definition.id}.metadata.${field}`,
          message: `Role "${definition.id}" has an empty ${field}.`,
        });
      }
    }

    if (!CATEGORY_PATTERN.test(definition.metadata.category)) {
      issues.push({
        code: "invalid-category",
        path: `roles.${definition.id}.metadata.category`,
        message: `Role "${definition.id}" has an invalid category name.`,
      });
    }

    if (!Number.isFinite(definition.balance.power)) {
      issues.push({
        code: "invalid-power",
        path: `roles.${definition.id}.balance.power`,
        message: `Role "${definition.id}" must have a finite power value.`,
      });
    }

    const handlers = getHandlers(definition);
    const hasDayCommand = handlers.some((handler) => handler.onDayCommand);
    const hasNightCommand = handlers.some((handler) => handler.onNightCommand);
    const hasNightVote = handlers.some((handler) => handler.onNightVote);

    if (
      (definition.capabilities.dayVisitSelf ||
        definition.capabilities.dayVisitOthers ||
        definition.capabilities.dayVisitFaction) &&
      !hasDayCommand
    ) {
      issues.push({
        code: "missing-day-command",
        path: `roles.${definition.id}.handlers`,
        message: `Role "${definition.id}" exposes day visit capability without an onDayCommand handler.`,
      });
    }

    if (
      (definition.capabilities.nightVisitSelf ||
        definition.capabilities.nightVisitOthers ||
        definition.capabilities.nightVisitFaction) &&
      !hasNightCommand
    ) {
      issues.push({
        code: "missing-night-command",
        path: `roles.${definition.id}.handlers`,
        message: `Role "${definition.id}" exposes night visit capability without an onNightCommand handler.`,
      });
    }

    if (definition.capabilities.nightVote && !hasNightVote) {
      issues.push({
        code: "missing-night-vote",
        path: `roles.${definition.id}.handlers`,
        message: `Role "${definition.id}" exposes night vote capability without an onNightVote handler.`,
      });
    }

    for (const trait of definition.traits) {
      if (
        (trait === RoleTrait.MafiaFactionMember ||
          trait === RoleTrait.LawmanFactionMember) &&
        !factionTraits.has(trait)
      ) {
        issues.push({
          code: "missing-faction-definition",
          path: `roles.${definition.id}.traits`,
          message: `Role "${definition.id}" uses trait "${trait}" without a matching faction definition.`,
        });
      }
    }
  }

  for (const definition of factions) {
    if (factionIds.has(definition.id)) {
      issues.push({
        code: "duplicate-faction-id",
        path: `factions.${definition.id}.id`,
        message: `Duplicate faction id "${definition.id}".`,
      });
    }
    factionIds.add(definition.id);

    if (definition.name.trim().length === 0) {
      issues.push({
        code: "empty-faction-name",
        path: `factions.${definition.id}.name`,
        message: `Faction "${definition.id}" must have a display name.`,
      });
    }

    if (definition.memberTraits.length === 0) {
      issues.push({
        code: "missing-member-traits",
        path: `factions.${definition.id}.memberTraits`,
        message: `Faction "${definition.id}" must declare at least one membership trait.`,
      });
    }

    for (const trait of definition.memberTraits) {
      const knownByRole = roles.some((role) => role.traits.includes(trait));
      if (!knownByRole) {
        issues.push({
          code: "unknown-member-trait",
          path: `factions.${definition.id}.memberTraits`,
          message: `Faction "${definition.id}" uses trait "${trait}" that is not present in the role catalog.`,
        });
      }
    }
  }

  return issues;
}

/**
 * Throws when the built-in catalogs are invalid.
 *
 * @param roles - Role definitions to validate.
 * @param factions - Faction definitions to validate.
 */
export function assertValidBuiltInCatalogs(
  roles: RoleDefinition[] = builtInRoleDefinitions,
  factions: FactionDefinition[] = builtInFactionDefinitions,
): void {
  const issues = validateBuiltInCatalogs(roles, factions);
  if (issues.length === 0) {
    return;
  }
  const details = issues
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid built-in role/faction catalogs:\n${details}`);
}
