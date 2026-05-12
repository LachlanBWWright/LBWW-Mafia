import type { Player } from "../../player/player.js";
import type { Room } from "../../rooms/room.js";
import { RoleFaction } from "@mernmafia/shared/game/rolesTypes";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import type { RoleDefinition } from "./roleDefinition.js";
import { RoleInstance } from "./roleInstance.js";
import { RoleTrait } from "./roleTraits.js";
import type { ValidationIssue } from "./validation.js";
import { chooseNightOther, chooseLivingTarget } from "./handlers/targeting.js";
import {
  addAttacker,
  applyDamageMinimum,
  applyDefenceMinimum,
  registerNightVisit,
  roleblockTarget,
} from "./handlers/effects.js";
import {
  actorNotice,
  dispatchNotice,
  factionNotice,
} from "./handlers/notices.js";
import { accepted, rejected } from "./handlers/results.js";
import { ComposedFaction } from "../../factions/composition/composedFaction.js";

export type CustomRoleBehaviorMessages = {
  selfKey?: MessageKey;
  successKey?: MessageKey;
};

export type CustomRoleBehavior =
  | { kind: "no-action" }
  | {
      kind: "night-attack";
      damage?: CombatLevel;
      canTargetSelf?: boolean;
      messages?: CustomRoleBehaviorMessages;
    }
  | {
      kind: "night-protect";
      defence?: CombatLevel;
      canTargetSelf?: boolean;
      messages?: CustomRoleBehaviorMessages;
    }
  | {
      kind: "roleblock";
      townAlways?: boolean;
      canTargetSelf?: boolean;
      messages?: CustomRoleBehaviorMessages;
    }
  | {
      kind: "investigate";
      result: "exact-role" | "alignment" | "guesses";
      canTargetSelf?: boolean;
      messages?: CustomRoleBehaviorMessages;
    };

export type CustomRoleDefinition = {
  kind: "custom";
  id?: number;
  metadata: {
    name: string;
    faction: RoleFaction;
    category: string;
    summary: string;
    description: string;
    powerValue?: number;
    isUnique?: boolean;
    capabilities: {
      dayVisitSelf: boolean;
      dayVisitOthers: boolean;
      dayVisitFaction: boolean;
      nightVisitSelf: boolean;
      nightVisitOthers: boolean;
      nightVisitFaction: boolean;
      nightVote?: boolean;
    };
  };
  behaviors?: CustomRoleBehavior[];
};

export function createRoleInstance(
  definition: RoleDefinition | CustomRoleDefinition,
  room: Room,
  player: Player,
): RoleInstance {
  return new RoleInstance(toRoleDefinition(definition), room, player);
}

export function toRoleDefinition(
  definition: RoleDefinition | CustomRoleDefinition,
): RoleDefinition {
  if (definition.kind === "built-in") {
    return definition;
  }
  const issues = validateCustomRoleDefinition(definition);
  if (issues.length > 0) {
    throw new CustomRoleValidationError(issues);
  }

  const groupMap: Record<CustomRoleDefinition["metadata"]["faction"], RoleGroup> = {
    [RoleFaction.Town]: RoleGroup.Town,
    [RoleFaction.Mafia]: RoleGroup.Mafia,
    [RoleFaction.Neutral]: RoleGroup.Neutral,
  };

  const capabilities = {
    dayVisitSelf: definition.metadata.capabilities.dayVisitSelf,
    dayVisitOthers: definition.metadata.capabilities.dayVisitOthers,
    dayVisitFaction: definition.metadata.capabilities.dayVisitFaction,
    nightVisitSelf: definition.metadata.capabilities.nightVisitSelf,
    nightVisitOthers: definition.metadata.capabilities.nightVisitOthers,
    nightVisitFaction: definition.metadata.capabilities.nightVisitFaction,
    nightVote: definition.metadata.capabilities.nightVote ?? false,
  };

  return {
    kind: "built-in",
    id: `custom-${definition.id ?? definition.metadata.name.toLowerCase().replaceAll(/\s+/g, "-")}`,
    metadata: {
      name: definition.metadata.name,
      group: groupMap[definition.metadata.faction],
      category: definition.metadata.category,
      summary: definition.metadata.summary,
      description: definition.metadata.description,
      isUnique: definition.metadata.isUnique ?? false,
    },
    balance: { power: definition.metadata.powerValue ?? 0 },
    combat: { baseDefence: CombatLevel.None },
    capabilities,
    traits: createCustomRoleTraits(definition, capabilities.nightVote),
    handlers: createCustomRoleHandlers(definition, capabilities.nightVote),
  };
}

function createCustomRoleTraits(
  definition: CustomRoleDefinition,
  canNightVote: boolean,
): RoleTrait[] {
  const traits: RoleTrait[] = [];
  if (definition.metadata.faction === RoleFaction.Town) {
    traits.push(RoleTrait.TownAligned);
  } else if (definition.metadata.faction === RoleFaction.Mafia) {
    traits.push(
      RoleTrait.MafiaAligned,
      RoleTrait.MafiaFactionMember,
      RoleTrait.CanBeMafiaAttacker,
    );
  } else {
    traits.push(RoleTrait.NeutralAligned);
  }
  if (definition.metadata.isUnique) {
    traits.push(RoleTrait.Unique);
  }
  if (canNightVote && definition.metadata.faction === RoleFaction.Mafia) {
    traits.push(RoleTrait.MafiaFactionMember);
  }
  return [...new Set(traits)];
}

function createGenericMafiaVoteHandler() {
  return {
    onNightVote: ({ role, recipient }) => {
      if (
        !(role.faction instanceof ComposedFaction) ||
        !recipient.isAlive ||
        recipient.role.faction === role.faction
      ) {
        role.attackVote = null;
        dispatchNotice(role, actorNotice({ key: MessageKey.MafiaInvalidVote }));
        return rejected;
      }
      role.faction.recordNightVote(role, recipient.role);
      dispatchNotice(
        role,
        factionNotice({
          key: MessageKey.MafiaVotedToAttack,
          params: {
            playerName: role.player.username,
            targetName: recipient.username,
          },
        }),
      );
      return accepted;
    },
  };
}

function chooseCustomNightTarget(
  role: RoleInstance,
  recipient: Player,
  behavior: Exclude<CustomRoleBehavior, { kind: "no-action" }>,
) {
  const defaultMessages =
    behavior.kind === "night-attack"
      ? {
          selfKey: MessageKey.InvalidChoice,
          successKey: MessageKey.ChoseToAttack,
        }
      : behavior.kind === "night-protect"
        ? {
            selfKey: MessageKey.CannotProtectSelf,
            successKey: MessageKey.ChoseToProtect,
          }
        : behavior.kind === "roleblock"
          ? {
              selfKey: MessageKey.CannotBlockSelf,
              successKey: MessageKey.ChoseToBlock,
            }
          : {
              selfKey: MessageKey.CannotInspectSelf,
              successKey: MessageKey.ChoseToInspect,
            };

  const selfKey = behavior.messages?.selfKey ?? defaultMessages.selfKey;
  const successKey = behavior.messages?.successKey ?? defaultMessages.successKey;

  if (behavior.canTargetSelf) {
    return chooseLivingTarget(role, recipient, successKey, (target) => {
      role.visiting = target;
    });
  }
  return chooseNightOther(role, recipient, selfKey, successKey);
}

function createInvestigativeVisitHandler(
  behavior: Extract<CustomRoleBehavior, { kind: "investigate" }>,
) {
  return {
    onNightVisit: ({ role }) => {
      const target = registerNightVisit(role);
      if (!target) return;
      if (behavior.result === "exact-role") {
        dispatchNotice(
          role,
          actorNotice({
            key: MessageKey.MafiaInvestigatorResult,
            params: {
              targetName: target.player.username,
              roleName: target.name,
            },
          }),
        );
        return;
      }
      if (behavior.result === "alignment") {
        let factionName = target.group;
        if (role.room.random() < 0.3) {
          const living = role.room.playerList.filter((player) => player.isAlive);
          factionName =
            living[role.room.randomIndex(living.length)]?.role.group ??
            factionName;
        }
        dispatchNotice(
          role,
          actorNotice({
            key: MessageKey.JudgeAlignmentResult,
            params: {
              targetName: target.player.username,
              factionName,
            },
          }),
        );
        return;
      }
      const guesses: string[] = [];
      for (let i = 0; i < 3; i++) {
        if (role.room.random() < 0.3) {
          guesses.push(target.name);
        } else {
          const randomPlayer =
            role.room.playerList[role.room.randomIndex(role.room.playerList.length)];
          guesses.push(randomPlayer?.role.name ?? target.name);
        }
      }
      dispatchNotice(
        role,
        actorNotice({
          key: MessageKey.InvestigatorResult,
          params: {
            targetName: target.player.username,
            role1: guesses[0] ?? "",
            role2: guesses[1] ?? "",
            role3: guesses[2] ?? "",
          },
        }),
      );
    },
  };
}

function createCustomRoleHandlers(
  definition: CustomRoleDefinition,
  includeNightVote: boolean,
) {
  const handlers: RoleDefinition["handlers"] =
    definition.behaviors?.flatMap((behavior) => {
      if (behavior.kind === "no-action") {
        return [];
      }
      const selectionHandler = {
        onNightCommand: ({ role, recipient }: { role: RoleInstance; recipient: Player }) =>
          chooseCustomNightTarget(role, recipient, behavior),
      };

      if (behavior.kind === "night-attack") {
        return [
          selectionHandler,
          {
            onNightVisit: ({ role }: { role: RoleInstance }) => {
              const target = registerNightVisit(role);
              if (!target) return;
              applyDamageMinimum(target, behavior.damage ?? CombatLevel.Low);
              addAttacker(target, role);
            },
          },
        ];
      }

      if (behavior.kind === "night-protect") {
        return [
          selectionHandler,
          {
            onNightVisit: ({ role }: { role: RoleInstance }) => {
              const target = registerNightVisit(role);
              if (!target) return;
              applyDefenceMinimum(target, behavior.defence ?? CombatLevel.Low);
            },
          },
        ];
      }

      if (behavior.kind === "roleblock") {
        return [
          selectionHandler,
          {
            onNightVisit: ({ role }: { role: RoleInstance }) => {
              const target = registerNightVisit(role);
              if (!target) return;
              if (
                behavior.townAlways ||
                target.group === RoleGroup.Town ||
                role.room.random() > 0.5
              ) {
                roleblockTarget(target, role);
              }
            },
          },
        ];
      }

      return [selectionHandler, createInvestigativeVisitHandler(behavior)];
    }) ?? [];

  if (includeNightVote) {
    handlers.unshift(createGenericMafiaVoteHandler());
  }
  return handlers;
}

/**
 * Structured validation error for custom role schema input.
 */
export class CustomRoleValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super("Invalid custom role definition.");
    this.issues = issues;
  }
}

/**
 * Validates a serializable custom role behavior definition.
 *
 * @param definition - Custom role to validate.
 * @returns Structured validation issues.
 */
export function validateCustomRoleDefinition(
  definition: CustomRoleDefinition,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const behaviors = definition.behaviors ?? [{ kind: "no-action" } satisfies CustomRoleBehavior];
  const activeNightBehaviors = behaviors.filter(
    (behavior) => behavior.kind !== "no-action",
  );

  if (definition.metadata.name.trim().length === 0) {
    issues.push({
      code: "missing-name",
      path: "metadata.name",
      message: "Custom roles must have a name.",
    });
  }

  if (behaviors.some((behavior) => behavior.kind === "no-action") && behaviors.length > 1) {
    issues.push({
      code: "conflicting-behaviors",
      path: "behaviors",
      message: '"no-action" cannot be combined with other custom role behaviors.',
    });
  }

  if (activeNightBehaviors.length > 1) {
    issues.push({
      code: "multiple-night-actions",
      path: "behaviors",
      message:
        "Custom roles currently support one active night behavior at a time.",
    });
  }

  if (
    activeNightBehaviors.length > 0 &&
    !definition.metadata.capabilities.nightVisitSelf &&
    !definition.metadata.capabilities.nightVisitOthers &&
    !definition.metadata.capabilities.nightVisitFaction
  ) {
    issues.push({
      code: "missing-night-visit-capability",
      path: "metadata.capabilities",
      message:
        "Night behaviors require at least one night visit capability flag.",
    });
  }

  if (
    definition.metadata.capabilities.nightVote &&
    definition.metadata.faction !== RoleFaction.Mafia
  ) {
    issues.push({
      code: "unsupported-night-vote",
      path: "metadata.capabilities.nightVote",
      message: "Only mafia custom roles can expose night voting.",
    });
  }

  for (const [index, behavior] of behaviors.entries()) {
    if (behavior.kind === "night-attack" && behavior.damage !== undefined && behavior.damage < CombatLevel.None) {
      issues.push({
        code: "invalid-damage",
        path: `behaviors.${index}.damage`,
        message: "Custom attack damage must be a valid CombatLevel.",
      });
    }
    if (behavior.kind === "night-protect" && behavior.defence !== undefined && behavior.defence < CombatLevel.None) {
      issues.push({
        code: "invalid-defence",
        path: `behaviors.${index}.defence`,
        message: "Custom protection defence must be a valid CombatLevel.",
      });
    }
  }

  return issues;
}
