# Composition-Based Role and Faction Refactor Plan

## Purpose

Move the game logic for roles and factions from subclass-heavy inheritance to a composition-based design. The goal is not just to support custom roles; it is to make the built-in role system use the same composable primitives so future roles, faction abilities, modifiers, and edge-case interactions can be assembled from smaller behaviors instead of adding more subclasses and override methods.

This plan is based on the current server game model:

- `server/model/roles/abstractRole.ts`
- `server/model/roles/roleInterface.ts`
- `server/model/roles/composition/*`
- `server/model/factions/abstractFaction.ts`
- `server/model/factions/mafiaFaction.ts`
- `server/model/factions/lawmanFaction.ts`
- `server/model/rooms/room.ts`
- `server/model/rooms/initRoles/roleHandler.ts`

The repo already has an early composition layer for custom roles under `server/model/roles/composition`. This plan reuses that direction, but turns it into the main production model for built-in roles and factions.

## Current State

### Role Model

The current role system is centered on `Role` in `abstractRole.ts`. `Role` is a concrete base class that owns shared state and default behavior, and every built-in role extends it directly or indirectly.

Current inheritance shape:

```text
Role
├── BlankRole
├── Doctor
├── Judge
├── Watchman
├── Investigator
├── Lawman
├── Vetter
├── Tapper
├── Tracker
├── Bodyguard
├── Nimby
├── Sacrificer
├── Fortifier
├── Roleblocker
├── Jailor
├── Maniac
├── Sniper
├── Framer
├── Confesser
├── Peacemaker
├── DynamicRole
└── RoleMafia
    ├── Mafia
    ├── MafiaRoleblocker
    ├── MafiaInvestigator
    └── MafiaSilencer
```

`Role` currently mixes several concerns:

- Static role identity: `name`, `group`
- Capability flags: `dayVisitSelf`, `nightVisitOthers`, `nightVote`, etc.
- Combat state: `baseDefence`, `defence`, `damage`, `attackers`
- Action state: `dayVisiting`, `visiting`, `attackVote`, `roleblocking`
- Status effects: `roleblocked`, `silenced`, `jailed`, `dayTapped`, `nightTapped`
- Chat routing: `handleMessage`
- Action command handling: `handleDayAction`, `handleNightAction`, `handleNightVote`
- Action resolution: `dayVisit`, `visit`, `receiveVisit`, `handleDayVisits`, `handleVisits`
- Lifecycle hooks: `initRole`, `dayUpdate`
- Death resolution: `handleDamage`

Most built-in roles override one or more lifecycle or action methods. That makes behavior hard to combine because the only extension mechanism is another subclass override.

### Existing Composition Layer

There is already a custom-role composition model:

- `ActionHandler`
- `ActionContext`
- `ApplyContext`
- `RoleMetadata`
- `RoleEffects`
- `CustomRoleDefinition`
- `DynamicRole`
- `VisitActionHandler`
- `ProtectiveActionHandler`
- `AggressiveActionHandler`
- `InvestigativeActionHandler`
- `VoteActionHandler`
- `CustomRoleFactory`

This layer is useful, but it currently has limitations:

- It still extends `Role`.
- It is focused on custom roles, not built-in roles.
- Handlers do not cover enough lifecycle points to model the full built-in set.
- Validation messages are plain strings in some places, while existing game code uses `MessageKey` payloads.
- Targeting, visit registration, phase order, status effects, and faction behavior are still mostly encoded in class methods and `Room`.
- Faction behavior is still inheritance-based.

### Faction Model

Factions currently extend `Faction`:

```text
Faction
├── MafiaFaction
└── LawmanFaction
```

`Faction` owns `memberList` and requires subclasses to implement:

- `findMembers`
- `sendMessage`
- `handleNightVote`
- `handleNightMessage`
- `removeMembers`

Faction behavior is tightly coupled to role identity:

- Mafia membership is `player.role.group == RoleGroup.Mafia`.
- Lawman membership is `player.role.name == "Lawman"`.
- Mafia voting depends on `member.role.attackVote`.
- Lawman insanity depends on `member.role.isInsane`.

This makes faction rules difficult to compose and reuse. It also makes special factions dependent on role names instead of explicit traits.

## Design Goals

1. Make built-in and custom roles use the same behavior model.
2. Keep game phase order explicit and testable.
3. Replace subclass overrides with role definitions composed from capabilities, effects, lifecycle hooks, and traits.
4. Replace faction subclasses with faction definitions composed from membership rules, chat policies, voting policies, and resolution effects.
5. Preserve current gameplay behavior during the migration.
6. Plan for a single coordinated refactor pass that updates roles, factions, factories, and room orchestration together.
7. Make role definitions data-driven enough for balancing, docs, client role display, and future custom role tooling.
8. Keep TypeScript types strong enough that invalid role definitions are caught early.

## Non-Goals

- Do not rewrite the entire game loop at once.
- Do not change gameplay rules unless a current behavior is clearly accidental and explicitly approved.
- Do not remove all classes immediately. Classes can remain as implementation details while the public role/faction model moves to definitions and composed behaviors.
- Do not make custom user scripting part of this refactor. Arbitrary user code should remain out of scope.
- Do not redesign client UI in this refactor except where role metadata needs to be consumed consistently.

## Target Architecture

### High-Level Shape

The target model should look like this:

```text
RoleDefinition
├── metadata
├── balance
├── capabilities
├── traits
├── statuses
├── handlers
│   ├── command handlers
│   ├── visit/effect handlers
│   ├── lifecycle handlers
│   ├── chat handlers
│   └── death/victory handlers
└── faction memberships

ComposedRole
└── RoleRuntimeState
    └── runs handlers from RoleDefinition

FactionDefinition
├── metadata
├── membership rule
├── chat policy
├── vote policy
├── resolution handlers
└── cleanup policy

ComposedFaction
└── FactionRuntimeState
    └── runs handlers from FactionDefinition
```

### Role Runtime Object

Introduce a new runtime role class, likely `ComposedRole`, that eventually replaces most subclasses.

Suggested file:

- `server/model/roles/composition/composedRole.ts`

Responsibilities:

- Hold `room` and `player`.
- Hold mutable runtime state.
- Expose the current `RoleInterface` while migration is in progress.
- Delegate behavior to composed handlers.
- Provide compatibility methods used by `Room`, such as `handleDayAction`, `handleNightAction`, `handleNightVote`, `visit`, `handleVisits`, `dayUpdate`, and `handleMessage`.

During migration, `ComposedRole` can still extend `Role` to avoid breaking all call sites. The final state should invert that dependency: `Role` either becomes a compatibility alias, a thin adapter, or is removed after `Room` and role instantiation no longer require subclass inheritance.

### Role Definition

Create a first-class role definition type. The current `RoleMetadata` is a good start but needs to be expanded.

Suggested file:

- `server/model/roles/composition/roleDefinition.ts`

Suggested shape:

```ts
export type RoleDefinition = {
  id: string;
  metadata: {
    name: string;
    group: RoleGroup;
    category: string;
    summary: string;
    description: string;
    isUnique: boolean;
  };
  balance: {
    power: number;
  };
  combat: {
    baseDefence: CombatLevel;
  };
  capabilities: RoleCapabilities;
  traits: RoleTrait[];
  handlers: RoleHandlerDefinition[];
  factionMemberships?: FactionMembershipDefinition[];
};
```

`RoleCapabilities` should replace the loose boolean fields:

```ts
export type RoleCapabilities = {
  day: TargetingCapability[];
  night: TargetingCapability[];
  voting: VotingCapability[];
  chat: ChatCapability[];
};
```

This keeps the client-friendly capability output while making server behavior less dependent on scattered booleans.

### Role Runtime State

Move mutable state out of the role definition and into a runtime object.

Suggested file:

- `server/model/roles/composition/roleRuntimeState.ts`

Suggested shape:

```ts
export type RoleRuntimeState = {
  faction?: FactionLike;
  baseDefence: CombatLevel;
  defence: CombatLevel;
  damage: CombatLevel;
  dayVisiting: RoleLike | null;
  visiting: RoleLike | null;
  visitors: RoleLike[];
  attackers: RoleLike[];
  roleblocking: RoleLike | null;
  attackVote: RoleLike | null;
  flags: {
    roleblocked: boolean;
    roleblocker: boolean;
    silenced: boolean;
    isAttacking: boolean;
    isInsane: boolean;
    victoryCondition: boolean;
  };
  statusRefs: {
    dayTapped: RoleLike | false;
    nightTapped: RoleLike | false;
    jailed: RoleLike | null;
  };
  custom: Record<string, unknown>;
};
```

The `custom` bucket is important for roles like `Fortifier`, `Framer`, and `Jailor`, which currently store role-specific state as class fields.

### Handler Interfaces

Expand the current `ActionHandler` into narrower handler categories. One broad optional-method interface works for a prototype, but named handler categories will make ordering and behavior easier to reason about.

Suggested files:

- `server/model/roles/composition/handlers/types.ts`
- `server/model/roles/composition/handlers/targeting.ts`
- `server/model/roles/composition/handlers/effects.ts`
- `server/model/roles/composition/handlers/lifecycle.ts`
- `server/model/roles/composition/handlers/chat.ts`
- `server/model/roles/composition/handlers/victory.ts`

Suggested interfaces:

```ts
export interface RoleLifecycleHandler {
  onAttach?(context: RoleAttachContext): void;
  onGameStart?(context: RoleLifecycleContext): void;
  onDayStart?(context: RoleLifecycleContext): void;
  onDayEnd?(context: RoleLifecycleContext): void;
  onNightStart?(context: RoleLifecycleContext): void;
  onNightEnd?(context: RoleLifecycleContext): void;
  onCleanup?(context: RoleCleanupContext): void;
}

export interface RoleCommandHandler {
  canHandleCommand(context: RoleCommandContext): boolean;
  validateCommand(context: RoleCommandContext): ValidationResult;
  executeCommand(context: RoleCommandContext): CommandResult;
}

export interface RoleEffectHandler {
  priority: EffectPriority;
  apply(context: RoleEffectContext): void;
}

export interface RoleVisitObserver {
  onReceiveVisit?(context: ReceiveVisitContext): void;
  afterVisitsResolved?(context: VisitOutcomeContext): void;
}

export interface RoleChatHandler {
  canHandleMessage(context: RoleChatContext): boolean;
  handleMessage(context: RoleChatContext): void;
}

export interface RoleVictoryHandler {
  onPlayerVotedOut?(context: VoteOutContext): void;
  onGameEnd?(context: GameEndContext): boolean;
}
```

The existing `ActionHandler` can remain as a compatibility layer while these are introduced.

### Message Results

Normalize handler output around existing `MessageKey` payloads instead of raw strings.

Suggested type:

```ts
export type GameNotice = {
  target: "actor" | "target" | "room" | "faction" | Player;
  event: ServerEvent;
  message: GameMessage | string;
};
```

Handlers should return structured results where practical. `ComposedRole` or a `GameEventDispatcher` should emit those results. This makes handlers easier to test without socket assertions.

### Faction Definition

Introduce `FactionDefinition` and `ComposedFaction`.

Suggested files:

- `server/model/factions/composition/factionDefinition.ts`
- `server/model/factions/composition/composedFaction.ts`
- `server/model/factions/definitions/mafia.ts`
- `server/model/factions/definitions/lawman.ts`

Suggested shape:

```ts
export type FactionDefinition = {
  id: string;
  name: string;
  membership: FactionMembershipRule;
  chatPolicy: FactionChatPolicy;
  votePolicy?: FactionVotePolicy;
  handlers: FactionHandler[];
};
```

Suggested handler categories:

```ts
export interface FactionMembershipRule {
  includes(player: Player, context: FactionContext): boolean;
}

export interface FactionChatPolicy {
  handleNightMessage(context: FactionChatContext): void;
}

export interface FactionVotePolicy {
  acceptVote(context: FactionVoteContext): ValidationResult;
  resolveVotes(context: FactionResolveVoteContext): void;
}

export interface FactionCleanupPolicy {
  keepMember(player: Player, context: FactionContext): boolean;
}
```

### Role Traits

Use traits for faction membership and special targeting interactions.

Examples:

```ts
export enum RoleTrait {
  TownAligned = "town-aligned",
  MafiaAligned = "mafia-aligned",
  NeutralAligned = "neutral-aligned",
  MafiaFactionMember = "mafia-faction-member",
  LawmanFactionMember = "lawman-faction-member",
  CanBeMafiaAttacker = "can-be-mafia-attacker",
  Roleblocker = "roleblocker",
  Unique = "unique",
}
```

This replaces checks like:

- `player.role.group === RoleGroup.Mafia`
- `player.role.name === "Lawman"`
- `player.role instanceof Confesser`
- `this.framer !== null`

Some identity checks can be kept only inside temporary tests or comparison helpers during the big pass. Production code should move to traits or explicit role IDs in the completed change.

## Single-Pass Strategy

This plan is intended for one large implementation pass, not a long sequence of compatibility PRs. The working branch should move the production game path from inheritance to composition in one coordinated change, then delete the old class path before merge.

The big pass still needs internal ordering. The key difference is that intermediate compatibility is allowed only inside the working branch. The final result should not ship with a mixed role system, a feature flag, or dual production paths.

## Single-Pass Workstreams

### 1. Capture Current Behavior

Before changing production code, add or update characterization tests for the behavior that is most likely to regress:

- Doctor cannot heal self.
- Doctor heals a night target by raising defence.
- Mafia members can vote at night.
- Mafia attack vote chooses an attacker and applies damage.
- Roleblocker resolves before other visits.
- Roleblocked non-roleblocker loses their visit.
- Jailor jails during the day and can execute at night.
- Framer gets a target and wins if the target is voted out.
- Confesser wins and disables voting when voted out.
- Fortifier permanent defence and counterattack behavior remains unchanged.
- Lawman faction randomizes insane member visit.
- Night cleanup clears `visiting`, `visitors`, `attackers`, temporary taps, and damage.

These tests do not need to compare old and new implementations indefinitely. They are a safety net while replacing the implementation in the same branch.

### 2. Build the Composition Core

Create the complete composition foundation before converting role definitions:

- `RoleDefinition`
- `RoleRuntimeState`
- `RoleCapabilities`
- `RoleTrait`
- `RoleFactory`
- `ComposedRole`
- `FactionDefinition`
- `ComposedFaction`
- `FactionFactory`
- `GameNotice` and command result types
- Handler type interfaces for commands, effects, lifecycle, chat, visits, combat, statuses, and victory

The existing `DynamicRole` should be folded into this path during the same pass. It can remain as a named export if client or custom-role code imports it, but internally it should create the same `ComposedRole` runtime used by built-in roles.

### 3. Add Game Systems

Move phase resolution out of role subclasses while converting the roles:

- `RoleCommandSystem`
- `FactionSystem`
- `VisitResolutionSystem`
- `CombatSystem`
- `StatusEffectSystem`
- `VictorySystem`
- `ChatSystem`

`Room` should still own lobby state, timers, socket entrypoints, match history, and high-level game start/end. It should delegate role/faction behavior to systems instead of importing concrete roles.

### 4. Convert All Built-In Roles to Definitions

Convert every built-in role in the same branch. Do not leave converted and unconverted production roles side by side.

Conversion groups:

- Simple target/effect roles: `Doctor`, `Investigator`, `Judge`, `Peacemaker`, `Maniac`, `Sniper`
- Observer and status roles: `Watchman`, `Tracker`, `Tapper`, `Roleblocker`, `MafiaRoleblocker`
- Protection and retaliation roles: `Bodyguard`, `Sacrificer`, `Nimby`, `Fortifier`
- Mafia roles: `Mafia`, `MafiaInvestigator`, `MafiaRoleblocker`, and decide whether `MafiaSilencer` should be included or removed
- Stateful special roles: `Jailor`, `Framer`, `Confesser`, `Lawman`
- No-op/default role: `BlankRole`

Each converted role should become a `RoleDefinition` plus reusable handlers. If a behavior is unique, create a small named handler rather than preserving a subclass.

### Example: Doctor Definition

```ts
export const doctorDefinition: RoleDefinition = {
  id: "doctor",
  metadata: {
    name: "Doctor",
    group: RoleGroup.Town,
    category: "town-support",
    summary: "Heals another player at night.",
    description: "Choose one living non-self player at night. Their defence is raised for that night.",
    isUnique: false,
  },
  balance: { power: 5 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    day: [],
    night: [{ phase: "night", targets: "others" }],
    voting: [],
    chat: ["default"],
  },
  traits: [RoleTrait.TownAligned],
  handlers: [
    targetOtherLivingPlayer({
      phase: GamePhase.Night,
      selfMessage: { key: MessageKey.DoctorCannotHealSelf },
      successMessage: { key: MessageKey.DoctorChoseToHeal },
      invalidMessage: { key: MessageKey.InvalidChoice },
    }),
    receiveVisitOnTarget(),
    applyDefence(CombatLevel.Low),
  ],
};
```

### 5. Convert Mafia Role and Mafia Faction Together

Mafia needs role and faction changes together because `RoleMafia` and `MafiaFaction` share state through `attackVote`, `isAttacking`, and `visiting`.

Current behavior to preserve:

- Mafia roles belong to `RoleGroup.Mafia`.
- Mafia roles can night vote.
- A mafia vote is invalid if target is not alive, target is in the same faction, or voter has no faction.
- Valid votes are broadcast to mafia members.
- During faction resolution, attack votes are collected.
- One voted victim is chosen randomly from votes.
- One mafia member is chosen randomly as attacker.
- The attacker visits the victim and applies low damage.
- `MafiaRoleblocker` and `MafiaInvestigator` can have special night actions while still participating in mafia behavior.

Implementation tasks:

1. Introduce `MafiaFactionDefinition`.
2. Introduce `FactionVotePolicy` for mafia attack voting.
3. Replace `RoleMafia.handleNightVote` with a composed `FactionVoteCommandHandler`.
4. Replace `MafiaFaction.handleNightVote` with `FactionVotePolicy.resolveVotes`.
5. Replace `RoleMafia.visitOverride` with an `ApplyMafiaAttackEffect`.
6. Convert all mafia role definitions in the same branch.
7. Delete `RoleMafia` once the composed mafia path is wired into `RoleHandler`.
8. Decide whether `MafiaSilencer` is intended to be in the game pool; it exists but is not currently imported into `RoleHandler`.

Acceptance criteria:

- Mafia voting and attack resolution remain behaviorally identical.
- Mafia role definitions compose faction membership plus role-specific actions.
- `RoleMafia` is removed from the production path.

### 6. Convert Status and Interaction Roles

These roles depend on timing and visit interactions.

Roles:

- `Roleblocker`
- `MafiaRoleblocker`
- `Tapper`
- `Tracker`
- `Watchman`
- `Bodyguard`
- `Sacrificer`
- `Nimby`

Required handler primitives:

Add reusable handlers for:

- Applying roleblock before normal visits.
- Marking a role as a roleblocker for priority processing.
- Observing who visited a target.
- Observing where a target visited.
- Redirecting or recording whispers/taps.
- Applying retaliation damage.
- Bodyguard-style protection and self-sacrifice.
- Visit notification and visitor registration.

### Room Dependency to Address

`Room.processNightActions` currently has hard-coded order:

1. `processFactionActions`
2. `processRoleBlockers`
3. `processVisitors`
4. `handleVisitOutcomes`
5. `cleanupNightState`

Composition should preserve this order exactly while moving the implementation to explicit priorities.

Suggested effect priorities:

```ts
export enum EffectPriority {
  Faction = 10,
  Roleblock = 20,
  Redirect = 30,
  Protection = 40,
  Attack = 50,
  Investigation = 60,
  Observer = 70,
  Cleanup = 100,
}
```

Acceptance criteria:

- Roleblocker priority is not based on `role.roleblocker` field checks in new role code.
- Converted roles express before/after visit behavior without overriding `visit` and `handleVisits`.
- Characterization tests for visit ordering pass.

### 7. Convert Stateful Special Roles

These roles need per-role custom runtime state.

Roles:

- `Jailor`
- `Fortifier`
- `Framer`
- `Confesser`
- `Lawman`

#### Jailor

Current behavior:

- Day action selects a jailed target.
- Jailed target is roleblocked.
- Jailor and jailed player can chat privately at night.
- Night action toggles execution.
- Execution applies fatal damage.

Needed primitives:

- `PersistedTargetState`
- `PrivateChatChannelHandler`
- `DayTargetCommandHandler`
- `NightToggleCommandHandler`
- `ApplyJailStatusEffect`
- `ApplyExecutionEffect`

#### Fortifier

Current behavior:

- Tracks `playerFortified`.
- Tracks `canFortify`.
- Adds permanent base defence.
- Can remove fortification.
- Removal randomly kills fortifier or owner.
- Counterattacks attackers on fortified house.

Needed primitives:

- `RoleStateSlot<T>`
- `PersistentDefenceModifier`
- `ToggleModeTargetHandler`
- `RandomOutcomeEffect`
- `AttackersRetaliationObserver`

#### Framer

Current behavior:

- Registers itself on `room.framer`.
- Chooses a random living town target.
- Gets a new target if current target dies before victory.
- Wins when target is voted out.

Needed primitives:

- `SelectRandomTargetLifecycleHandler`
- `VoteOutVictoryHandler`
- `RoleRegistry` or `RoomRoleIndex` so `Room` does not need `room.framer`.

#### Confesser

Current behavior:

- `Room.handlePlayerVotedOut` checks `player.role instanceof Confesser`.
- If voted out, voting is disabled and Confesser wins.

Needed primitives:

- `OnSelfVotedOutHandler`
- `DisableVotingEffect`
- `SetVictoryConditionEffect`

#### Lawman

Current behavior:

- Lawman faction membership is based on role name.
- Insane lawmen are forced to visit random alive players.

Needed primitives:

- `LawmanFactionDefinition`
- `RoleTrait.LawmanFactionMember`
- `InsanityStatus`
- `ForcedRandomVisitFactionHandler`

Acceptance criteria:

- No `Room` field stores a specific role instance like `framer`, `peacemaker`, or `confesser`.
- Special role behavior is represented by handlers and runtime state slots.
- Vote-out and game-end behavior can be contributed by role handlers.

### 8. Convert Factions Fully

Tasks:

1. Add `ComposedFaction`.
2. Convert `MafiaFaction` to definition-based behavior.
3. Convert `LawmanFaction` to definition-based behavior.
4. Replace `assignFactionsFromPlayerList` hard-coded loops with a registry of faction definitions.
5. Replace membership checks by role name/group with trait or membership rules.
6. Replace `Faction.memberList` direct mutation with `refreshMembers`.
7. Replace `Faction.initializeMembers` with a shared membership initialization handler.

Suggested registry:

```ts
export const factionDefinitions = [
  mafiaFactionDefinition,
  lawmanFactionDefinition,
];
```

`RoleHandler` or a new `FactionFactory` can instantiate only factions with at least one member:

```ts
const factions = factionDefinitions
  .map((definition) => new ComposedFaction(definition, room))
  .filter((faction) => faction.hasMembers(playerList));
```

Acceptance criteria:

- `abstractFaction.ts`, `mafiaFaction.ts`, and `lawmanFaction.ts` are removed or reduced to non-production compatibility exports.
- New faction behavior does not require subclassing.
- Faction membership is determined by traits/rules, not concrete role classes or names.

### 9. Replace RoleHandler and Registries

`RoleHandler` currently hard-codes role pools, power values, uniqueness, and class constructors. In the big pass, replace that production model completely.

Tasks:

1. Add a central role definition registry.
2. Replace role pool arrays of classes with arrays of `RoleDefinition`.
3. Replace `ROLE_POWER_VALUES` switch usage with `definition.balance.power`.
4. Replace `uniqueRoleCheck` switch usage with `definition.metadata.isUnique`.
5. Replace `instantiateRole` with a factory that always returns `ComposedRole`.
6. Remove production support for class constructors in role assignment.
7. Keep custom-role definitions flowing through the same factory.

Acceptance criteria:

- `RoleHandler.assignGame` returns role definitions, not subclasses.
- `RoleHandler` has no imports from concrete built-in role class files.
- Built-in roles and custom roles instantiate through one runtime path.

### 10. Replace Room Special Cases

`Room` currently calls role methods directly and imports role classes for special cases. In the big pass, keep `Room` as the phase owner but remove role-specific knowledge.

Systems to introduce:

- `RoleCommandSystem`
- `FactionSystem`
- `VisitResolutionSystem`
- `CombatSystem`
- `StatusEffectSystem`
- `VictorySystem`
- `ChatSystem`

Tasks:

1. Add a `GameSystems` wrapper owned by `Room`.
2. Move `processFactionActions` into `FactionSystem`.
3. Move `processRoleBlockers`, `processVisitors`, and `handleVisitOutcomes` into `VisitResolutionSystem`.
4. Move `handleDamage` into `CombatSystem`.
5. Move vote-out special role checks into `VictorySystem`.
6. Keep `Room` responsible for high-level phase timing and persistence.

Acceptance criteria:

- `Room` no longer needs role-specific imports like `Confesser`, `Framer`, or `Peacemaker`.
- Phase processing order is expressed in one place.
- Role/faction behavior is contributed through registered handlers.

### 11. Delete Inheritance Dependencies

Tasks:

1. Stop extending `Role` for production roles.
2. Replace `RoleInterface` with a smaller `RoleLike` interface.
3. Replace `instanceof Role` checks with interface checks or state references.
4. Remove concrete built-in role subclasses.
5. Remove `RoleMafia`.
6. Remove production `Faction` subclasses.
7. Collapse `DynamicRole` and `ComposedRole` if they are redundant.
8. Rename composition folder concepts if needed once composition is the only role system.

Acceptance criteria:

- Adding a new built-in role does not require creating a subclass.
- Adding a new faction does not require creating a subclass.
- Built-in roles and custom roles use the same factory/runtime path.

## Built-In Role Migration Matrix

| Role | Current Base | Migration Difficulty | Main Behaviors to Compose |
| --- | --- | ---: | --- |
| BlankRole | Role | Low | No actions, unaligned defaults |
| Doctor | Role | Low | Night target other, heal/defence, receive visit |
| Investigator | Role | Low | Night target other, reveal role/faction/alignment |
| Judge | Role | Low | Night target, likely vote/kill/protect behavior depending current implementation |
| Peacemaker | Role | Low-Medium | Neutral win/draw condition |
| Maniac | Role | Low-Medium | Night attack |
| Sniper | Role | Medium | Night attack plus visitor/outcome interactions |
| Watchman | Role | Medium | Target observation, visitor reporting |
| Tracker | Role | Medium | Target movement reporting |
| Tapper | Role | Medium | Day/night tap, whisper/night chat observation |
| Roleblocker | Role | Medium | Priority roleblock effect |
| Mafia | RoleMafia | Medium | Faction night vote, faction attack |
| MafiaInvestigator | RoleMafia | Medium | Mafia membership plus investigation |
| MafiaRoleblocker | RoleMafia | Medium | Mafia membership plus roleblock |
| MafiaSilencer | RoleMafia | Medium | Mafia membership plus silence; confirm if used |
| Bodyguard | Role | Medium-High | Protection, retaliation, possible self-sacrifice |
| Sacrificer | Role | Medium-High | Protection/sacrifice behavior |
| Nimby | Role | Medium-High | Visitor/attack interaction behavior |
| Lawman | Role | High | Lawman faction, insanity, random forced visits |
| Jailor | Role | High | Day jail, night execution toggle, private chat, roleblock |
| Fortifier | Role | High | Persistent target state, base defence mutation, random defortify death, retaliation |
| Framer | Role | High | Random target assignment, vote-out victory, target refresh |
| Confesser | Role | High | Vote-out special victory and disables voting |

Before migrating each role, read the actual file and fill in exact behavior in a dedicated test. Do not rely solely on this matrix.

## Definition Registry Plan

Create a central registry for built-in role definitions.

Suggested file:

- `server/model/roles/definitions/index.ts`

Suggested exports:

```ts
export const builtInRoleDefinitions: RoleDefinition[] = [
  doctorDefinition,
  investigatorDefinition,
  mafiaDefinition,
  // ...
];

export const roleDefinitionById = new Map(
  builtInRoleDefinitions.map((definition) => [definition.id, definition]),
);
```

Update `RoleHandler` to work with definitions:

```ts
type RoleSelectionEntry = RoleDefinition | CustomRoleDefinition;
```

Then `assignGame` can select definitions instead of classes, and `instantiateRole` can always call a role factory.

## RoleHandler Refactor Plan

`RoleHandler` currently hard-codes role pools, power values, uniqueness, and class constructors.

Refactor sequence:

1. Add `RoleSelectionEntry`.
2. Add helper functions:
   - `getRolePower(entry)`
   - `isUniqueRole(entry)`
   - `getRoleGroup(entry)`
3. Replace `ROLE_POWER_VALUES` switch usage with `definition.balance.power`.
4. Replace `uniqueRoleCheck` switch usage with `definition.metadata.isUnique`.
5. Replace role pool arrays of classes with arrays of definitions.
6. Replace class constructor instantiation with `RoleFactory.createRole`.
7. Remove built-in class support from production role assignment.

## Room Refactor Plan

`Room` should be updated in the same pass as the role and faction conversion. It should keep ownership of game timing and socket entrypoints, but it should stop knowing about concrete role classes.

Replace direct role-specific imports and fields:

- Remove `room.framer`.
- Remove `room.peacemaker`.
- Remove `room.confesser`.
- Replace `player.role instanceof Confesser`.
- Replace role-specific win checks with `VictorySystem`.

Move phase processing into systems:

```ts
this.systems.factions.resolveNight();
this.systems.visits.resolveNight();
this.systems.combat.resolveDeaths();
this.systems.victory.check();
```

`Room` should remain responsible for:

- Lobby/user state
- Phase timing
- Socket-level command entrypoints
- Match history
- High-level game start/end

## Compatibility and Data Model Rules

### Preserve In The Final Behavior

- Existing role names.
- Existing `RoleGroup` values.
- Existing `CombatLevel` semantics.
- Existing socket events.
- Existing `MessageKey` payloads.
- Existing action order.
- Existing match history shape.

### Replace In The Big Pass

- Role subclasses.
- Faction subclasses.
- `Room` role-specific imports.
- Name-based membership checks.
- Switch statements for power and uniqueness.
- Direct `instanceof` checks.

### Avoid

- Handler code directly emitting sockets when a structured result can be returned.
- New role-specific fields on `ComposedRole`.
- New role-specific checks in `Room`.
- Stringly typed role IDs without central constants.

## Testing Plan

### Unit Tests

Add unit tests for handler primitives:

- Target validation.
- Self-target rejection.
- Dead target rejection.
- Faction target rejection.
- Defence application.
- Damage application.
- Roleblock application.
- Visitor registration.
- Investigation output.
- Chat routing.
- Faction membership.
- Faction vote collection.
- Faction vote resolution.

### Integration Tests

Add room-level tests for phase processing:

- Day action selection.
- Night action selection.
- Night faction vote.
- Roleblock priority.
- Visit resolution order.
- Damage and death cleanup.
- Vote-out special outcomes.
- End-game faction detection.

### Characterization Tests

The test suite should describe expected gameplay behavior, not the old class hierarchy. For the big pass, write tests against public command and phase behavior, then replace the implementation underneath them. Avoid keeping long-lived old-versus-new parity tests in production because they preserve the inheritance model as a dependency.

### Regression Areas

Pay special attention to:

- Socket message payloads changing from `GameMessage` to string accidentally.
- Action cancellation clearing the wrong field.
- `dayVisiting` versus `visiting`.
- Roleblocker priority.
- Mafia attack vote resolution randomness.
- Permanent versus temporary defence.
- Cleanup resetting persistent role state by mistake.
- Neutral victory conditions.

## Implementation Order Summary

1. Add characterization tests and behavior matrix.
2. Stabilize composition types.
3. Add `RoleDefinition`, `RoleRuntimeState`, and `ComposedRole`.
4. Make `DynamicRole` use the new runtime path.
5. Convert simple town/neutral roles.
6. Convert mafia role/faction behavior together.
7. Convert status and observer roles.
8. Convert stateful special roles.
9. Convert factions to definitions.
10. Move phase orchestration out of direct role methods.
11. Remove inheritance adapters.

## Suggested File Layout

```text
server/model/roles/
├── composition/
│   ├── composedRole.ts
│   ├── roleDefinition.ts
│   ├── roleRuntimeState.ts
│   ├── roleTraits.ts
│   ├── roleFactory.ts
│   ├── resultTypes.ts
│   └── handlers/
│       ├── types.ts
│       ├── targeting.ts
│       ├── effects.ts
│       ├── lifecycle.ts
│       ├── chat.ts
│       ├── combat.ts
│       ├── status.ts
│       └── victory.ts
├── definitions/
│   ├── index.ts
│   ├── town.ts
│   ├── mafia.ts
│   └── neutral.ts

server/model/factions/
├── composition/
│   ├── composedFaction.ts
│   ├── factionDefinition.ts
│   ├── factionFactory.ts
│   └── handlers.ts
└── definitions/
    ├── index.ts
    ├── mafia.ts
    └── lawman.ts

server/model/rooms/systems/
├── roleCommandSystem.ts
├── factionSystem.ts
├── visitResolutionSystem.ts
├── combatSystem.ts
├── statusEffectSystem.ts
├── victorySystem.ts
└── chatSystem.ts
```

## Big-Pass Rollback Strategy

Because this is a single large refactor, rollback should happen at the branch or commit level, not by shipping a dual runtime path. Keep commits organized so the branch can be bisected while developing:

1. Tests and behavior fixtures.
2. Composition core and systems.
3. Role definitions and handlers.
4. Faction definitions and handlers.
5. `Room` and `RoleHandler` rewiring.
6. Deletion of old subclasses.

If verification fails late in the pass, fix forward inside the branch using the characterization tests. Do not add a production feature flag that can switch back to inherited roles.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Phase order changes accidentally | High | Characterization tests around `Room.processNightActions` |
| Socket messages change shape | High | Assert emitted `ServerEvent` and `MessageKey` payloads in tests |
| Persistent role state gets cleaned as temporary state | High | Separate `RoleRuntimeState.custom` from cleanup-managed fields |
| Role/faction circular dependencies grow | Medium | Use traits and definitions instead of importing concrete roles |
| Handler order becomes hard to reason about | Medium | Use explicit priorities and document each phase |
| Converted roles lose client capability flags | Medium | Derive compatibility booleans from `RoleCapabilities` |
| Custom roles diverge from built-in roles | Medium | Make both use `ComposedRole` and shared factory |
| Big pass becomes hard to review | High | Split commits by workstream, keep old classes deleted only after tests pass |

## Completion Criteria

The refactor is complete when:

- Built-in roles are represented as `RoleDefinition` objects.
- Built-in factions are represented as `FactionDefinition` objects.
- `RoleHandler` selects definitions rather than concrete role classes.
- `Room` no longer imports concrete role classes for special cases.
- `RoleMafia` is removed.
- `MafiaFaction` and `LawmanFaction` subclasses are removed from the production code path.
- Custom roles and built-in roles instantiate through the same factory.
- Adding a new role normally means adding a definition plus any missing reusable handler, not adding a subclass.
- Tests cover role command handling, phase resolution, factions, combat, cleanup, and victory behavior.

## Single-Pass Execution Checklist

1. Add characterization tests for the current gameplay surface.
2. Add composition core types, runtime state, factories, and result types.
3. Add role, faction, command, visit, combat, status, chat, and victory systems.
4. Define every built-in role as a `RoleDefinition`.
5. Define every production faction as a `FactionDefinition`.
6. Rewire `RoleHandler` to select definitions and instantiate through `RoleFactory`.
7. Rewire `Room` to delegate behavior to systems and remove role-specific imports.
8. Fold `DynamicRole` custom-role creation into the same composed runtime.
9. Delete inherited built-in role classes, `RoleMafia`, and production faction subclasses.
10. Run server tests, shared tests, typecheck, and lint.
11. Manually smoke-test a room with town, mafia, neutral, roleblock, jail, and vote-out interactions.
