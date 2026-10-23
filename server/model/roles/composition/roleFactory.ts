import type { Player } from "../../player/player.js";
import type { Room } from "../../rooms/room.js";
import { RoleFaction } from "@mernmafia/shared/game/rolesTypes";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { z } from "zod";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import type { RoleDefinition, RoleCapabilityFlags } from "./roleDefinition.js";
import {
  nightActionRoleDefinition,
  nightActionWithNightVoteRoleDefinition,
  nightVoteRoleDefinition,
  passiveRoleDefinition,
} from "./roleDefinition.js";
import { RoleInstance } from "./roleInstance.js";
import { RoleTrait } from "./roleTraits.js";
import { chooseNightOther, chooseLivingTarget } from "./handlers/targeting.js";
import {
  addAttacker,
  applyDamageMinimum,
  applyDefenceMinimum,
  registerNightVisit,
  roleblockTarget,
} from "./handlers/effects.js";
import { actorNotice, dispatchNotice, factionNotice } from "./handlers/notices.js";
import { accepted, rejected } from "./handlers/results.js";
import type { RoleHandlerInput } from "./handlers/types.js";

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

const customRoleBehaviorMessagesSchema = z.object({
  selfKey: z.nativeEnum(MessageKey).optional(),
  successKey: z.nativeEnum(MessageKey).optional(),
});

const customRoleBehaviorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("no-action") }),
  z.object({
    kind: z.literal("night-attack"),
    damage: z.nativeEnum(CombatLevel).optional(),
    canTargetSelf: z.boolean().optional(),
    messages: customRoleBehaviorMessagesSchema.optional(),
  }),
  z.object({
    kind: z.literal("night-protect"),
    defence: z.nativeEnum(CombatLevel).optional(),
    canTargetSelf: z.boolean().optional(),
    messages: customRoleBehaviorMessagesSchema.optional(),
  }),
  z.object({
    kind: z.literal("roleblock"),
    townAlways: z.boolean().optional(),
    canTargetSelf: z.boolean().optional(),
    messages: customRoleBehaviorMessagesSchema.optional(),
  }),
  z.object({
    kind: z.literal("investigate"),
    result: z.enum(["exact-role", "alignment", "guesses"]),
    canTargetSelf: z.boolean().optional(),
    messages: customRoleBehaviorMessagesSchema.optional(),
  }),
]);

export const CustomRoleInputSchema = z.object({
  kind: z.literal("custom"),
  id: z.number().int().optional(),
  metadata: z.object({
    name: z.string(),
    faction: z.nativeEnum(RoleFaction),
    category: z.string(),
    summary: z.string(),
    description: z.string(),
    powerValue: z.number().optional(),
    isUnique: z.boolean().optional(),
    capabilities: z.object({
      dayVisitSelf: z.boolean(),
      dayVisitOthers: z.boolean(),
      dayVisitFaction: z.boolean(),
      nightVisitSelf: z.boolean(),
      nightVisitOthers: z.boolean(),
      nightVisitFaction: z.boolean(),
      nightVote: z.boolean().optional(),
    }),
  }),
  behaviors: z.array(customRoleBehaviorSchema).optional(),
});

export type CustomRoleDefinition = z.infer<typeof CustomRoleInputSchema>;

export type CustomRoleIssue = {
  code: string;
  path: string;
  message: string;
};

type CompileResult<T> =
  | { status: "ok"; value: T }
  | { status: "error"; issues: CustomRoleIssue[] };

const factionGroupMap: Record<RoleFaction, RoleGroup> = {
  [RoleFaction.Town]: RoleGroup.Town,
  [RoleFaction.Mafia]: RoleGroup.Mafia,
  [RoleFaction.Neutral]: RoleGroup.Neutral,
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

  const parsedInput = parseCustomRoleInput(definition);
  if (parsedInput.status === "error") {
    throw new CustomRoleInputError(parsedInput.issues);
  }

  const compiled = compileCustomRole(parsedInput.value);
  if (compiled.status === "error") {
    throw new CustomRoleCompileError(compiled.issues);
  }
  return compiled.value;
}

export function parseCustomRoleInput(rawInput: unknown): CompileResult<CustomRoleDefinition> {
  const parsed = CustomRoleInputSchema.safeParse(rawInput);
  if (parsed.success) {
    return { status: "ok", value: parsed.data };
  }
  return {
    status: "error",
    issues: parsed.error.issues.map((issue) => ({
      code: "invalid-input-shape",
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

export function compileCustomRole(
  definition: CustomRoleDefinition,
): CompileResult<RoleDefinition> {
  const issues = collectCustomRoleDomainIssues(definition);
  if (issues.length > 0) {
    return { status: "error", issues };
  }

  const includeNightVote = definition.metadata.capabilities.nightVote ?? false;
  const behaviors = definition.behaviors ?? [{ kind: "no-action" } satisfies CustomRoleBehavior];
  const activeBehavior = behaviors.find(
    (behavior): behavior is Exclude<CustomRoleBehavior, { kind: "no-action" }> =>
      behavior.kind !== "no-action",
  );
  const baseDefinition = {
    kind: "built-in" as const,
    id: toCustomRoleId(definition),
    metadata: {
      name: definition.metadata.name,
      group: factionGroupMap[definition.metadata.faction],
      category: definition.metadata.category,
      summary: definition.metadata.summary,
      description: definition.metadata.description,
      isUnique: definition.metadata.isUnique ?? false,
    },
    balance: { power: definition.metadata.powerValue ?? 0 },
    combat: { baseDefence: CombatLevel.None },
    traits: createCustomRoleTraits(definition, includeNightVote),
  };
  const nightCapabilities: RoleCapabilityFlags = {
    self: definition.metadata.capabilities.nightVisitSelf,
    others: definition.metadata.capabilities.nightVisitOthers,
    faction: definition.metadata.capabilities.nightVisitFaction,
  };

  if (!activeBehavior && includeNightVote) {
    return {
      status: "ok",
      value: nightVoteRoleDefinition({
        ...baseDefinition,
        onNightVote: createGenericMafiaVoteHandler().onNightVote[0]!,
      }),
    };
  }

  if (!activeBehavior) {
    return { status: "ok", value: passiveRoleDefinition(baseDefinition) };
  }

  const onNightCommand = ({ role, recipient }: { role: RoleInstance; recipient: Player }) =>
    chooseCustomNightTarget(role, recipient, activeBehavior);
  const behaviorHandlers = createCustomBehaviorHandlers(activeBehavior);

  if (includeNightVote) {
    return {
      status: "ok",
      value: nightActionWithNightVoteRoleDefinition({
        ...baseDefinition,
        night: nightCapabilities,
        onNightVote: createGenericMafiaVoteHandler().onNightVote[0]!,
        onNightCommand,
        handlers: behaviorHandlers,
      }),
    };
  }

  return {
    status: "ok",
    value: nightActionRoleDefinition({
      ...baseDefinition,
      night: nightCapabilities,
      onNightCommand,
      handlers: behaviorHandlers,
    }),
  };
}

function toCustomRoleId(definition: CustomRoleDefinition): string {
  return `custom-${definition.id ?? definition.metadata.name.toLowerCase().replaceAll(/\s+/g, "-")}`;
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
    onNightVote: [({ role, recipient }) => {
      if (!role.faction || !recipient.isAlive || recipient.role.faction === role.faction) {
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
    }],
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
    onNightVisit: [({ role }) => {
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
          factionName = living[role.room.randomIndex(living.length)]?.role.group ?? factionName;
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
    }],
  };
}

function createCustomBehaviorHandlers(
  behavior: Exclude<CustomRoleBehavior, { kind: "no-action" }>,
) : RoleHandlerInput {
  if (behavior.kind === "night-attack") {
    return {
      onNightVisit: [({ role }: { role: RoleInstance }) => {
        const target = registerNightVisit(role);
        if (!target) return;
        applyDamageMinimum(target, behavior.damage ?? CombatLevel.Low);
        addAttacker(target, role);
      }],
    };
  }

  if (behavior.kind === "night-protect") {
    return {
      onNightVisit: [({ role }: { role: RoleInstance }) => {
        const target = registerNightVisit(role);
        if (!target) return;
        applyDefenceMinimum(target, behavior.defence ?? CombatLevel.Low);
      }],
    };
  }

  if (behavior.kind === "roleblock") {
    return {
      onNightVisit: [({ role }: { role: RoleInstance }) => {
        const target = registerNightVisit(role);
        if (!target) return;
        if (
          behavior.townAlways ||
          target.group === RoleGroup.Town ||
          role.room.random() > 0.5
        ) {
          roleblockTarget(target, role);
        }
      }],
    };
  }

  return createInvestigativeVisitHandler(behavior);
}

function collectCustomRoleDomainIssues(
  definition: CustomRoleDefinition,
): CustomRoleIssue[] {
  const issues: CustomRoleIssue[] = [];
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

  if (
    definition.metadata.capabilities.dayVisitSelf ||
    definition.metadata.capabilities.dayVisitOthers ||
    definition.metadata.capabilities.dayVisitFaction
  ) {
    issues.push({
      code: "unsupported-day-capabilities",
      path: "metadata.capabilities",
      message: "Custom roles currently only support night actions.",
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
      message: "Custom roles currently support one active night behavior at a time.",
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
      message: "Night behaviors require at least one night visit capability flag.",
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

  return issues;
}

export class CustomRoleInputError extends Error {
  readonly issues: CustomRoleIssue[];

  constructor(issues: CustomRoleIssue[]) {
    super("Invalid custom role input.");
    this.issues = issues;
  }
}

export class CustomRoleCompileError extends Error {
  readonly issues: CustomRoleIssue[];

  constructor(issues: CustomRoleIssue[]) {
    super("Unsupported custom role definition.");
    this.issues = issues;
  }
}
