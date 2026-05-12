# Backend Game Logic Architecture Analysis

## Executive Summary

This document provides a comprehensive analysis of the MERN Mafia backend game logic architecture, identifies current architectural patterns and potential improvements, and investigates pathways for enabling user-created custom roles/classes in the frontend.

---

## 1. Current Architecture Overview

### 1.1 High-Level Architecture

The backend game logic is structured around three main layers:

```
Frontend (Socket.IO/PartyKit Events)
         ↓
Game Room (game orchestration)
         ↓
Players & Roles (game state)
         ↓
Factions (coordinated mechanics)
         ↓
Database (match history persistence)
```

### 1.2 Core Components

#### **1.2.1 Room Class** (`server/model/rooms/room.ts`)

- **Responsibility**: Central orchestrator of game state and lifecycle
- **Key Responsibilities**:
  - Manages user connection lifecycle (pre-game lobby)
  - Initializes games and assigns roles
  - Orchestrates day/night phase transitions
  - Records conversation and action history
  - Emits events to all players
- **State Properties**:
  - `userList`: Players in lobby
  - `playerList`: Active game participants
  - `roleList`: Role class assignments
  - `factionList`: Coordinated role groups
  - `time`: Current game phase (Idle, Day, Night)
  - `conversationHistory`/`actionHistory`: Game record

#### **1.2.2 Role Hierarchy** (`server/model/roles/`)

**Abstract Base Class: `Role`**

```typescript
export abstract class Role {
  readonly room: Room;
  readonly player: Player;

  // Identity
  abstract readonly name: string;
  abstract readonly group: RoleGroup;

  // Combat state
  abstract baseDefence: CombatLevel;
  defence: CombatLevel;
  damage: CombatLevel;

  // Visit capabilities
  abstract readonly dayVisitSelf: boolean;
  abstract readonly dayVisitOthers: boolean;
  abstract readonly dayVisitFaction: boolean;
  abstract readonly nightVisitSelf: boolean;
  abstract readonly nightVisitOthers: boolean;
  abstract readonly nightVisitFaction: boolean;
  abstract readonly nightVote: boolean;

  // Role-specific state
  visiting: Role | null;
  visitors: Role[];
  attackers: Role[];
  roleblocked: boolean;
  silenced: boolean;
  // ... more state
}
```

**Role Subclasses by Group**:

- **Town**: Doctor, Judge, Watchman, Investigator, Lawman, Vetter, Tapper, Tracker, Bodyguard, Nimby, Sacrificer, Fortifier, Roleblocker, Jailor
- **Mafia**: Mafia, MafiaRoleblocker, MafiaInvestigator (extends RoleMafia)
- **Neutral**: Maniac, Sniper, Framer, Confesser, Peacemaker

**Key Methods in Role**:

```typescript
initRole(): void                    // Called at game start
dayUpdate(): void                   // Called at day phase start
handleMessage(message: string): void
handleDayAction(recipient: Player): void
handleNightAction(recipient: Player): void  // (implemented by subclasses)
visit(): void                       // Process night actions
canVoteTarget(): void               // (evaluated by shared logic)
```

#### **1.2.3 Player Class** (`server/model/player/player.ts`)

```typescript
export class Player {
  readonly user: User;
  readonly username: string;
  role!: Role; // Assigned at game start
  isAlive: boolean;
  hasVoted: boolean;
  votesReceived: number;
}
```

#### **1.2.4 Faction System** (`server/model/factions/`)

**Abstract Base**:

```typescript
export abstract class Faction {
  memberList: Player[] = [];

  abstract findMembers(playerList: Player[]): void;
  abstract sendMessage(message: string): void;
  abstract handleNightVote(): void;
  abstract handleNightMessage(message: string, playerUsername: string): void;
  abstract removeMembers(): void;
}
```

**Implementations**:

- `MafiaFaction`: Coordinates all Mafia roles for night kills
- `LawmanFaction`: Coordinates Lawman members

#### **1.2.5 Role Handler** (`server/model/rooms/initRoles/roleHandler.ts`)

**Responsibilities**:

1. **Role Assignment**: Selects balanced role sets for given player count
2. **Power Balancing**: Uses comparative power scoring to maintain game balance
   - Each role has a power value (e.g., DOCTOR: 5, JAILOR: 12, MAFIA: -13)
   - Tries to keep town/mafia power within ±15 tolerance
3. **Uniqueness Enforcement**: Prevents duplicate unique roles
4. **Faction Creation**: Instantiates and assigns factions to players

**Current Power Values**:

```typescript
const ROLE_POWER_VALUES = {
  DOCTOR: 5,
  JUDGE: 6,
  WATCHMAN: 4,
  // ... 27 roles total
  MAFIA: -13,
  MAFIA_ROLEBLOCKER: -20,
  MAFIA_INVESTIGATOR: -15,
  // ...
};
```

### 1.3 Communication Flow

#### **1.3.1 Client-Server Events** (`shared/communication/events.ts`)

**Server → Client Events**:

```typescript
enum ServerEvent {
  ReceiveMessage           // Chat/system messages
  BlockMessages           // During specific phases
  ReceiveNewPlayer        // Lobby updates
  RemovePlayer           // Player left
  ReceivePlayerList      // Lobby player list
  ReceiveChatMessage     // Game chat
  ReceiveWhisperMessage  // Whispered messages
  UpdateDayTime          // Phase/time updates
  DisableVoting          // Voting period end
  UpdatePlayerRole       // Faction member role reveal
  AssignPlayerRole       // Personal role assignment
  ReceiveRole            // Legacy role format
  UpdatePlayerVisit      // Action confirmation
}
```

**Client → Server Events**:

```typescript
enum ClientEvent {
  PlayerJoinRoom      // + captcha token
  MessageSentByUser   // + message, isDay
  HandleVote          // + recipient index, isDay
  HandleVisit         // + recipient index, isDay
  HandleWhisper       // + recipient index, message, isDay
  Disconnect
}
```

#### **1.3.2 Role Data Transmission**

When a game starts, each player receives:

```typescript
type PlayerReturned = {
  name: string;
  role: string;
  dayVisitSelf: boolean;
  dayVisitOthers: boolean;
  dayVisitFaction: boolean;
  nightVisitSelf: boolean;
  nightVisitOthers: boolean;
  nightVisitFaction: boolean;
  nightVote: boolean;
};
```

### 1.4 Shared Game Logic\*\* (`shared/game/`)

#### **1.4.1 Role Catalog** (`shared/game/roles.ts`)

Defines all role metadata for client display:

```typescript
type RoleCatalogEntry = {
  name: string;
  faction: RoleFaction; // "town" | "mafia" | "neutral"
  category: string;
  summary: string;
  description: string;
};
```

#### **1.4.2 Player Action Rules** (`shared/game/playerActionRules.ts`)

Functions for client-side UI validation:

- `canPerformVisit()`: Validates visit actions based on capabilities
- `canVoteTarget()`: Validates voting eligibility
- `shouldShowVisitAction()`: Determines UI visibility
- `shouldShowDayOnlyActions()`: Phase-based UI rendering

### 1.5 Data Persistence\*\* (`db/schema.ts`)

**Match History Storage**:

```typescript
export const matches = createTable("match", () => ({
  id: serial("id").primaryKey(),
  roomName: varchar("room_name", { length: 255 }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
  winningFaction: varchar("winning_faction", { length: 255 }).notNull(),
  winningRoles: text("winning_roles").notNull(),
  playerCount: integer("player_count").notNull(),
  conversationHistory: text("conversation_history").notNull(),
  actionHistory: text("action_history").notNull(),
}));

export const matchParticipants = createTable("match_participant", () => ({
  // Links users to match outcomes and roles played
  matchId: integer("match_id").references(() => matches.id),
  userId: varchar("user_id").references(() => users.id),
  username: varchar("username").notNull(),
  role: varchar("role").notNull(),
  won: boolean("won").notNull(),
}));
```

---

## 2. Code Analysis: Findings and Observations

### 2.1 Strengths

#### **2.1.1 Clean Separation of Concerns**

✅ **Finding**: The architecture effectively separates:

- Game orchestration (Room)
- Role behavior (Role subclasses)
- Faction coordination (Faction classes)
- Client communication (events)
- UI validation (shared action rules)

#### **2.1.2 Type Safety**

✅ **Finding**: Strong use of TypeScript:

- Enum-based phase management (`GamePhase`, `DayTime`)
- Type-safe role names (string literals)
- Typed Socket.IO event definitions
- Combat level enumeration

#### **2.1.3 Extensibility via Inheritance**

✅ **Finding**: New roles can be created by:

1. Extending `Role` abstract class
2. Implementing 9+ abstract properties
3. Optionally overriding lifecycle methods
4. Adding to roleHandler's role list

#### **2.1.4 Power Balancing Algorithm**

✅ **Finding**: Sophisticated role assignment system:

- Comparative power scoring prevents overpowered teams
- Dynamic adjustment based on current imbalance
- Respects unique role constraints

#### **2.1.5 Non-invasive Backend Abstraction**

✅ **Finding**: Socket.IO/PartyKit abstraction layer:

- `GameEmitter` interface decouples from implementation
- Game logic doesn't import socket libraries directly
- Factions and roles use abstracted emit pattern

### 2.2 Weaknesses and Pain Points

#### **2.2.1 Hardcoded Role Registry**

❌ **Issue**: Role instantiation requires manual import and registration

- **Location**: `roleHandler.ts` lines 6-33
- **Problem**: Every new role requires:

  ```typescript
  import { Doctor } from "../../roles/town/doctor.js";
  // ... 26 more imports

  let randomTownList: (typeof BlankRole)[] = [
    Doctor, // Must be added here
    // ... manually list all roles
  ];
  ```

- **Impact**:
  - Not scalable for user-created roles
  - Error-prone (easy to forget to register)
  - No runtime role discovery mechanism

**Root Cause**: Roles are stored as class references, not metadata.

#### **2.2.2 Tight Coupling Between Capabilities and Mechanics**

❌ **Issue**: Visit capability flags are tightly bound to action implementation

- **Observation**: Properties like `dayVisitOthers`, `nightVisitSelf` exist on Role but actual behavior in `handleNightAction()` is role-specific
- **Example**: Doctor's heal increases defense, but Bodyguard's protection kills attackers — both use `nightVisitOthers`
- **Problem**: Capabilities alone don't define behavior
- **Impact**: Hard to create "behavior templates" — each role reinvents its action handling

#### **2.2.3 No Role Composition/Mixins**

❌ **Issue**: Roles cannot share mechanics

- **Example**: Multiple protective roles (Doctor, Bodyguard, Sacrificer, Fortifier) each implement visit logic independently
- **Problem**: Code duplication, harder to maintain consistency
- **Solution Would Look Like**: Mixins, traits, or composable action handlers

#### **2.2.4 Magic Values and Duplicated Constants**

❌ **Issue**: Role metadata exists in multiple places

- **Locations**:
  1. Role class name (e.g., `name = "Doctor"`)
  2. `rolesList.ts` array definitions
  3. `roles.ts` RoleCatalogEntry entries
  4. `roleHandler.ts` ROLE_POWER_VALUES object
  5. Database matchParticipants.role field (strings)
- **Impact**:
  - Inconsistency risk
  - Updates require multiple file edits
  - Single source of truth missing

#### **2.2.5 Role State Management Complexity**

❌ **Issue**: Role class mixes state, identity, and behavior

- **State Properties** (28+ properties on Role):
  - Identity: `name`, `group`
  - Capabilities: `dayVisitSelf`, `nightVisitOthers`, etc.
  - Combat: `defence`, `damage`, `baseDefence`
  - Mechanics: `visiting`, `visitors`, `attackers`, `roleblocked`, `silenced`, `jailed`, etc.
- **Problem**:
  - Roles that don't need certain state still inherit it
  - Hard to understand minimum viable role
  - Potential for accidental state pollution

#### **2.2.6 Weak Validation of Actions**

❌ **Issue**: Visit action validation is incomplete

- **Observation**: `handleNightAction()` in roles validates inputs manually with string messages
- **Example** (Doctor):
  ```typescript
  if (recipient == this.player) {
    io.to(...).emit(ServerEvent.ReceiveMessage, "You cannot heal yourself.");
  } else if (recipient.username != undefined && recipient.isAlive) {
    this.visiting = recipient.role;
  }
  ```
- **Problems**:
  - No centralized validation rules
  - Messages duplicated across roles
  - No structured error handling
  - Validation rules live in multiple places

#### **2.2.7 Limited Faction Abstraction**

❌ **Issue**: Faction system is tightly coupled to MafiaFaction/LawmanFaction

- **Current Model**: Factions are singletons per role group
- **Problem**: Hard to implement:
  - Dynamic faction formation
  - Sub-factions
  - Conditional faction membership
  - Non-hierarchical coordinated mechanics

#### **2.2.8 No Role Versioning or Variants**

❌ **Issue**: Each role is a fixed implementation

- **Observation**: No way to create role variants (e.g., "Doctor (Enhanced)", "Mafia (Weak)")
- **Problem**: Custom game modes would require forking roles
- **Impact**: Limits game customization options

#### **2.2.9 Role Assignment Algorithm is Deterministic but Opaque**

❌ **Issue**: Role selection uses randomization but is hard to debug/customize

- **Problem**:
  - Complex control flow with multiple random selections
  - No logging of decision rationale
  - Hard to create themed role sets
  - No support for preset configurations

#### **2.2.10 Minimal Role Documentation**

❌ **Issue**: Role capabilities are self-evident but behavior is only documented in code

- **Observation**: JSDoc comments are present but don't explain:
  - Interaction with other roles
  - Win condition logic
  - Edge cases or special mechanics

### 2.3 Testing Gaps

❌ **Observation**:

- No unit tests for Role subclasses found
- No integration tests for role interactions
- Power balancing algorithm has no test coverage
- Action validation logic is untested
- Match history persistence has no validation tests

---

## 3. Recommended Improvements

### 3.1 Architecture Improvements (High Priority)

#### **3.1.1 Implement a Role Registry Pattern**

**Current State**: Manual imports and registration

**Proposed Solution**:

```typescript
// roles/roleRegistry.ts
export class RoleRegistry {
  private static roles = new Map<string, RoleMetadata>();

  static register(metadata: RoleMetadata, RoleClass: typeof Role) {
    this.roles.set(metadata.name, { ...metadata, class: RoleClass });
  }

  static getRoles(): RoleMetadata[] {
    return Array.from(this.roles.values());
  }

  static getRoleClass(name: string): typeof Role | null {
    return this.roles.get(name)?.class ?? null;
  }

  static getMetadata(name: string): RoleMetadata | null {
    return this.roles.get(name) ?? null;
  }
}

// types/roleMetadata.ts
export type RoleMetadata = {
  name: string;
  faction: "town" | "mafia" | "neutral";
  category: string;
  summary: string;
  description: string;
  powerValue: number;
  isUnique: boolean;
  capabilities: VisitCapability;
};
```

**Benefits**:

- ✅ Central role registry enables dynamic role loading
- ✅ Supports user-created roles without code changes
- ✅ Single source of truth for role metadata
- ✅ Enables reflection-based role discovery

#### **3.1.2 Extract Role Metadata from Implementation**

**Current State**: Role name and capabilities are scattered

**Proposed Solution**:

```typescript
// roles/town/doctor.ts
export class Doctor extends Role {
  static readonly metadata: RoleMetadata = {
    name: "Doctor",
    faction: "town",
    category: "Town Protective",
    summary: "Protect a player from attacks.",
    description: "...",
    powerValue: 5,
    isUnique: false,
    capabilities: {
      dayVisitSelf: false,
      dayVisitOthers: false,
      dayVisitFaction: false,
      nightVisitSelf: false,
      nightVisitOthers: true,
      nightVisitFaction: false,
    },
  };

  static {
    // Register on class load
    RoleRegistry.register(Doctor.metadata, Doctor);
  }

  // ... rest of implementation
}
```

**Benefits**:

- ✅ Metadata co-located with implementation
- ✅ Eliminates duplication across rolesList.ts, roles.ts, roleHandler.ts
- ✅ Self-registering reduces boilerplate
- ✅ Type-safe metadata

#### **3.1.3 Consolidate Role State into Capability-Based Structure**

**Current State**: Role has 28+ state properties

**Proposed Solution**:

```typescript
// Create composable role states
export type RoleState = {
  identity: RoleIdentity;
  capabilities: VisitCapability;
  status: StatusEffects;
  mechanics: RoleMechanics;
};

export type StatusEffects = {
  roleblocked: boolean;
  silenced: boolean;
  jailed: Role | null;
  defended: boolean;
};

export type RoleMechanics = {
  visits: VisitTracker;
  combat: CombatTracker;
  actions: ActionTracker;
};

// Refactored Role base class
export abstract class Role {
  readonly identity: RoleIdentity;
  readonly state: RoleState;

  constructor(room: Room, player: Player, metadata: RoleMetadata) {
    this.identity = { name: metadata.name, group: metadata.faction };
    this.state = {
      identity: this.identity,
      capabilities: metadata.capabilities,
      status: {
        roleblocked: false,
        silenced: false,
        jailed: null,
        defended: false,
      },
      mechanics: {
        visits: {},
        combat: { defence: CombatLevel.None, damage: CombatLevel.None },
        actions: [],
      },
    };
  }
}
```

**Benefits**:

- ✅ Clear, organized state structure
- ✅ Easier to understand role composition
- ✅ Minimal roles don't inherit unused properties
- ✅ Better for serialization/persistence

#### **3.1.4 Implement Role Behavior Interface**

**Current State**: Behavior hardcoded in each role's handleNightAction()

**Proposed Solution**:

```typescript
// roles/behaviors/roleBehavior.ts
export interface RoleBehavior {
  onDayAction?(recipient: Player): ActionResult;
  onNightAction?(recipient: Player): ActionResult;
  onVisit?(visitor: Role): void;
  onReceiveVisit?(target: Role): void;
  onPhaseEnd?(phase: GamePhase): void;
}

export type ActionResult = {
  success: boolean;
  message: string;
  effect?: RoleEffect;
};

// Example: Protective behavior template
export class ProtectiveBehavior implements RoleBehavior {
  constructor(private defenseLevel: CombatLevel) {}

  onNightAction(recipient: Player): ActionResult {
    return {
      success: true,
      message: `You protected ${recipient.username}`,
      effect: { target: recipient, type: "protect", value: this.defenseLevel },
    };
  }

  onReceiveVisit(target: Role): void {
    target.defence = Math.max(target.defence, this.defenseLevel);
  }
}

// Usage in role
export class Doctor extends Role {
  private behavior = new ProtectiveBehavior(CombatLevel.Low);

  handleNightAction(recipient: Player) {
    const result = this.behavior.onNightAction(recipient);
    io.to(...).emit(ServerEvent.ReceiveMessage, result.message);
    if (result.effect) this.applyEffect(result.effect);
  }
}
```

**Benefits**:

- ✅ Decouples behavior from identity
- ✅ Enables behavior composition/mixins
- ✅ Easier to test behaviors independently
- ✅ Supports role variants with different behaviors

#### **3.1.5 Centralize Action Validation**

**Current State**: Each role validates actions independently

**Proposed Solution**:

```typescript
// validation/actionValidator.ts
export class ActionValidator {
  static validateVisit(input: {
    actor: Role;
    target: Player;
    phase: GamePhase;
    capability: VisitCapability;
  }): ValidationResult {
    const errors: string[] = [];

    if (!input.actor.player.isAlive) {
      errors.push("Dead players cannot act");
    }
    if (!input.target.isAlive) {
      errors.push("Cannot target dead players");
    }
    if (input.actor.player === input.target) {
      errors.push("Cannot target yourself");
    }

    // Check capability
    const canVisit = canPerformVisit({
      time: input.phase === GamePhase.Day ? DayTime.Day : DayTime.Night,
      isSelf: input.actor.player === input.target,
      targetAlive: input.target.isAlive,
      actorAlive: input.actor.player.isAlive,
      capability: input.capability,
    });

    if (!canVisit) {
      errors.push("You cannot perform this action");
    }

    return { valid: errors.length === 0, errors };
  }
}
```

**Benefits**:

- ✅ Single validation logic source
- ✅ Consistent error messaging
- ✅ Testable validation rules
- ✅ Reusable across different action types

---

### 3.2 Code Quality Improvements (Medium Priority)

#### **3.2.1 Add Comprehensive Test Suite**

**Missing Tests**:

- Unit tests for each Role subclass
- Role interaction integration tests
- Power balancing algorithm tests
- Action validation tests
- Faction coordination tests

**Proposed Structure**:

```typescript
// roles/__tests__/doctor.test.ts
describe("Doctor Role", () => {
  it("should heal target and increase defense", () => {
    const room = createMockRoom();
    const player = createMockPlayer();
    const doctor = new Doctor(room, player);
    const target = createMockPlayer();

    doctor.handleNightAction(target);
    doctor.visit();

    expect(target.role.defence).toBe(CombatLevel.Low);
  });

  it("should prevent self-healing", () => {
    const doctor = new Doctor(room, player);
    doctor.handleNightAction(player);

    expect(doctor.visiting).toBeNull();
  });
});
```

#### **3.2.2 Implement Role Documentation Generator**

**Solution**: Generate role interaction docs from metadata

```typescript
// Generate markdown with:
// - Capabilities matrix (what each role can do)
// - Interaction matrix (how roles interact)
// - Balance data (power scores, win rates)
// - Changelog (role adjustments over time)
```

#### **3.2.3 Add Structured Error Handling**

**Current**: String-based messages
**Proposed**: Typed error results

```typescript
type ActionError = {
  code: "INVALID_TARGET" | "SELF_TARGET" | "DEAD" | ...;
  message: string;
  severity: "INFO" | "WARNING" | "ERROR";
};
```

#### **3.2.4 Use Dependency Injection for Configuration**

**Current**: Magic constants hardcoded
**Proposed**:

```typescript
export class GameConfig {
  readonly roleBalanceTolerance = 15;
  readonly dayStartDelayMs = 5000;
  readonly maxGameDays = 25;

  // ... make all constants configurable
}
```

---

### 3.3 Architecture Patterns to Adopt (Low Priority, Future)

#### **3.3.1 Command Pattern for Actions**

Instead of `handleNightAction()`, use command objects:

```typescript
type ActionCommand = {
  type: "visit" | "vote" | "whisper";
  actor: Role;
  target: Player;
  execute(): void;
  validate(): ValidationResult;
};
```

#### **3.3.2 Event Sourcing for Game State**

Store immutable event log instead of mutable state:

```typescript
type GameEvent =
  | { type: "RoleAssigned"; role: string; player: string }
  | { type: "ActionExecuted"; action: ActionCommand }
  | { type: "PlayerDied"; player: string; cause: string }
  | ...;
```

#### **3.3.3 Plugin Architecture**

Allow custom roles without code changes:

```typescript
// roles/custom/userCreatedRole.ts
export default {
  name: "Custom Role",
  metadata: {...},
  class: CustomRole,
} as RolePlugin;
```

---

## 4. Custom Roles in Frontend: Technical Investigation

### 4.1 Current State: Frontend Role Display

#### **4.1.1 Role Display Architecture**

**Mobile (RolesScreen.tsx)**:

```typescript
import {
  roleSections,
  type RoleCatalogEntry,
} from "@mernmafia/shared/game/roles";

// Displays pre-defined role sections:
// - Town Roles
// - Mafia Roles
// - Neutral Roles
```

**Web (Nextjs)**:

- Likely similar role catalog import
- Displays role reference

**Key Observation**: Both frontends import pre-compiled role data from `shared/game/roles.ts`

#### **4.1.2 Role Data Flow**

```
Backend                               Frontend
─────────────────────────────────────────────
Room.startGame()
  ├─ RoleHandler.assignGame()
  ├─ Creates Role instances
  └─ io.to(user).emit(
       ServerEvent.AssignPlayerRole,
       { name, role, capabilities }
     )
                                      ← receives PlayerReturned
                                      ← stores in game state
                                      ← displays role name + capabilities
```

### 4.2 Requirements Analysis: Custom Roles

#### **4.2.1 User Stories**

1. **User Story 1**: "As a game creator, I want to define a custom role with a unique name, faction, and night action."
2. **User Story 2**: "As a frontend user, I want to see custom roles I created in the role list."
3. **User Story 3**: "As a player, I want to be assigned a custom role during a game and see its capabilities."
4. **User Story 4**: "As an admin, I want to approve/publish custom roles for community use."

#### **4.2.2 Constraints**

- Custom roles must not break game balance
- Server must validate custom role definitions
- Custom roles must be persistent (database)
- Custom roles must be reusable across multiple games
- Custom role creation UI must be user-friendly

### 4.3 Architecture: Custom Roles Feature

#### **4.3.1 Data Model**

**New Database Tables**:

```typescript
// Custom role storage
export const customRoles = createTable("custom_role", () => ({
  id: serial("id").primaryKey(),
  creatorId: varchar("creator_id", { length: 255 })
    .notNull()
    .references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  faction: varchar("faction", { length: 50 }).notNull(), // "town" | "mafia" | "neutral"
  category: varchar("category", { length: 255 }).notNull(),
  summary: text("summary").notNull(),
  description: text("description").notNull(),

  // Capabilities
  dayVisitSelf: boolean("day_visit_self").default(false),
  dayVisitOthers: boolean("day_visit_others").default(false),
  dayVisitFaction: boolean("day_visit_faction").default(false),
  nightVisitSelf: boolean("night_visit_self").default(false),
  nightVisitOthers: boolean("night_visit_others").default(false),
  nightVisitFaction: boolean("night_visit_faction").default(false),
  nightVote: boolean("night_vote").default(false),

  // Game balance
  powerValue: integer("power_value").default(0),
  isUnique: boolean("is_unique").default(false),

  // Metadata
  isPublished: boolean("is_published").default(false),
  approvedBy: varchar("approved_by_id").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
}));

// Custom role game associations
export const customRoleAssignments = createTable(
  "custom_role_assignment",
  () => ({
    id: serial("id").primaryKey(),
    gameId: varchar("game_id"), // references match room name
    playerId: varchar("player_id"),
    customRoleId: integer("custom_role_id")
      .notNull()
      .references(() => customRoles.id),
  }),
);
```

#### **4.3.2 Backend Services**

**New TRPC Router**:

```typescript
// shared/trpc/appRouter.ts - added to router
customRole: t.router({
  // Create custom role
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      faction: z.enum(["town", "mafia", "neutral"]),
      category: z.string(),
      summary: z.string(),
      description: z.string(),
      capabilities: z.object({
        dayVisitSelf: z.boolean(),
        dayVisitOthers: z.boolean(),
        // ... all 6 visit flags
      }),
      powerValue: z.number().min(-20).max(20),
      isUnique: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate custom role definition
      // Check for name conflicts
      // Create in database
      // Return created role with ID
    }),

  // List user's custom roles
  listMine: protectedProcedure
    .query(async ({ ctx }) => {
      // Get all custom roles created by user
    }),

  // List published custom roles
  listPublished: t.procedure
    .query(async () => {
      // Get all approved, published roles
    }),

  // Update custom role
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      // ... same fields as create
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      // Update in database
    }),

  // Delete custom role
  delete: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      // Delete (or mark as archived)
    }),

  // Request approval
  submitForApproval: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      // Mark role as pending review
    }),

  // Admin approval
  approve: adminProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      // Mark as published
    }),
}),
```

#### **4.3.3 Runtime Role Loading**

**Refactored RoleHandler**:

```typescript
export class RoleHandler {
  private registry: RoleRegistry;
  private customRoles: CustomRoleDefinition[];

  constructor(roomSize: number, customRoles?: CustomRoleDefinition[]) {
    this.roomSize = roomSize;
    this.customRoles = customRoles || [];
    this.registry = new RoleRegistry();

    // Register built-in roles
    this.registerBuiltInRoles();

    // Dynamically register custom roles
    this.registerCustomRoles();
  }

  private registerBuiltInRoles() {
    [Doctor, Judge, Watchman, ...].forEach(RoleClass => {
      RoleRegistry.register(RoleClass.metadata, RoleClass);
    });
  }

  private registerCustomRoles() {
    this.customRoles.forEach(customDef => {
      // Create dynamic role class from definition
      const DynamicRole = this.createRoleFromDefinition(customDef);
      RoleRegistry.register(customDef, DynamicRole);
    });
  }

  private createRoleFromDefinition(def: CustomRoleDefinition): typeof Role {
    // Factory function that generates a Role subclass from custom definition
    return class DynamicRole extends Role {
      static metadata = def;
      name = def.name;
      group = def.faction; // Convert faction to group
      // ... copy capabilities from def

      constructor(room: Room, player: Player) {
        super(room, player);
      }

      // Default behavior - can be overridden
      handleNightAction(recipient: Player) {
        io.to(this.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          `You targeted ${recipient.username} with your night action.`,
        );
        this.visiting = recipient.role;
      }
    };
  }
}
```

#### **4.3.4 Game Room Integration**

**Updated Room.startGame()**:

```typescript
async startGame() {
  // Fetch custom roles if game was configured with them
  let customRoles = [];
  if (this.roomSettings?.allowCustomRoles) {
    customRoles = await db
      .select()
      .from(customRoles)
      .where(eq(customRoles.isPublished, true));
  }

  const roleHandler = new RoleHandler(this.userList.length, customRoles);
  this.roleList.push(...roleHandler.assignGame());

  // ... rest of game start
}
```

#### **4.3.5 Communication Protocol**

**Updated PlayerReturned Type**:

```typescript
export type PlayerReturned = {
  name: string;
  role: string;
  customRoleId?: number; // If custom role
  isCustomRole: boolean;
  dayVisitSelf: boolean;
  dayVisitOthers: boolean;
  dayVisitFaction: boolean;
  nightVisitSelf: boolean;
  nightVisitOthers: boolean;
  nightVisitFaction: boolean;
  nightVote: boolean;
};
```

### 4.4 Frontend Implementation Plan

#### **4.4.1 Custom Role Management UI (Web - Nextjs)**

**New Pages**:

1. `/custom-roles` - List personal custom roles
2. `/custom-roles/create` - Create new custom role
3. `/custom-roles/:id/edit` - Edit existing custom role
4. `/custom-roles/:id/preview` - Preview before publish
5. `/browse-custom-roles` - Discover published roles

**Components Needed**:

```typescript
// components/CustomRoleForm.tsx
- Input: role name, faction, category
- Input: summary, description (markdown preview)
- Checkbox grid: 6 visit capabilities
- Slider: power value (-20 to 20)
- Toggle: unique role
- Validation: name uniqueness, balanced power value
- Preview: shows role as it would appear

// components/CustomRoleCard.tsx
- Display role metadata
- Show creator name
- Show edit/delete buttons if owner
- Show approval status
- Show usage stats (times played)

// components/RoleCapabilityMatrix.tsx
- Shows all capabilities in visual grid
- Phase (Day/Night) on one axis
- Target type (Self/Others/Faction) on other
- Color-coded for enabled/disabled
```

#### **4.4.2 Lobby Settings Integration**

**Game Creation Flow**:

```
User clicks "Create Game"
  ↓
Game settings modal
  ├─ Standard settings (player count, etc.)
  └─ NEW: "Custom Role Settings"
       ├─ [checkbox] Allow custom roles
       └─ [dropdown] Select which custom roles to enable
              - None
              - All published
              - Specific selection
```

#### **4.4.3 Role Reference Display**

**Updated RolesScreen**:

```typescript
// Display both built-in and custom roles
{roleSections.map(section => <RoleSection ... />)}
{customRoles.map(role => (
  <CustomRoleCard role={role} key={role.id} />
))}
```

#### **4.4.4 Game Lobby Updates**

**Player List Display**:

```typescript
// Show custom roles with badge indicator
{players.map(player => (
  <PlayerRow
    name={player.name}
    role={player.role}
    isCustomRole={player.isCustomRole}
    customRoleCreator={player.customRoleCreator}
  />
))}
```

### 4.5 Implementation Roadmap

#### **Phase 1: Backend Infrastructure (2-3 sprints)**

1. ✅ Database schema for custom roles
2. ✅ Custom role CRUD endpoints (TRPC)
3. ✅ Custom role validation logic
4. ✅ Role registry + dynamic role loading
5. ✅ Game room integration
6. ✅ Match history tracking for custom roles

**Deliverable**: Backend can save/load custom roles, assign them in games, track usage

#### **Phase 2: Frontend Management UI (2-3 sprints)**

1. ✅ Custom role list page
2. ✅ Create/edit custom role form
3. ✅ Role preview system
4. ✅ Input validation on frontend
5. ✅ Published roles browsing

**Deliverable**: Users can create, edit, delete custom roles

#### **Phase 3: Game Integration (1-2 sprints)**

1. ✅ Lobby settings for custom roles
2. ✅ Role assignment in games
3. ✅ Custom role display in player list
4. ✅ Role reference updates

**Deliverable**: Games can be created with custom roles

#### **Phase 4: Community Features (1-2 sprints)**

1. ✅ Role approval workflow (admin)
2. ✅ Published roles marketplace
3. ✅ Role ratings/reviews
4. ✅ Usage statistics
5. ✅ Balance analytics

**Deliverable**: Community can discover and use popular custom roles

### 4.6 Risk Mitigation

#### **Risk 1: Game Balance Broken by Bad Custom Roles**

- **Mitigation**:
  - Hard power value limits (-20 to 20)
  - Default safe capabilities (no special mechanics)
  - Staged rollout: draft → submitted → approved
  - Analytics to track win rates of custom roles
  - Admin tools to disable problematic roles

#### **Risk 2: Server Crashes from Invalid Custom Roles**

- **Mitigation**:
  - Strict validation of custom role definitions
  - Try-catch around dynamic role instantiation
  - Fallback to blank role if custom role fails to load
  - Comprehensive logging

#### **Risk 3: Performance Impact**

- **Mitigation**:
  - Cache custom role registry in memory
  - Only load used roles into Room
  - Don't instantiate all role classes until game start

#### **Risk 4: Inappropriate Custom Roles**

- **Mitigation**:
  - Content filtering on role description
  - Community flagging system
  - Admin review before publication
  - Terms of service

### 4.7 Alternative Approaches Considered

#### **4.7.1 Client-Side Role Definitions (Rejected)**

- **Idea**: Let clients define roles, server accepts them as-is
- **Problem**:
  - Server security vulnerability
  - Unbalanced games
  - No audit trail
- **Decision**: Server must validate and approve

#### **4.7.2 Template-Based Roles (Alternative)**

- **Idea**: Provide role templates (Protective, Investigative, etc.)
- **Advantage**: Easier for users, safer for balance
- **Implementation**:

  ```typescript
  type RoleTemplate = "protective" | "investigative" | "voting";

  const config = {
    name: "My Investigator",
    template: "investigative",
    // Customize parameters within bounds
  };
  ```

- **Status**: Consider as Phase 2 enhancement

---

## 5. Summary and Recommendations

### 5.1 Quick Wins (Implement First)

1. **Extract Role Metadata** (1 sprint)
   - Move all role constants to static properties on Role classes
   - Eliminate duplication between rolesList.ts, roles.ts, roleHandler.ts
   - **Impact**: Easier maintenance, foundation for custom roles

2. **Add Role Registry** (1 sprint)
   - Implement RoleRegistry for dynamic role discovery
   - Update RoleHandler to use registry
   - **Impact**: Prerequisite for custom roles

3. **Centralize Validation** (0.5 sprint)
   - Create ActionValidator class
   - Eliminate duplicate validation in roles
   - **Impact**: Fewer bugs, easier to extend

4. **Add Tests** (2-3 sprints)
   - Unit tests for each Role subclass
   - Integration tests for interactions
   - **Impact**: Catch regressions, enable refactoring

### 5.2 Medium-Term Improvements

5. **Implement Custom Roles Feature** (4-6 sprints)
   - Following phases described in Section 4.5
   - Incremental rollout with approval system
   - **Impact**: Major new feature, user engagement

6. **Refactor Role State** (2 sprints)
   - Separate identity, capabilities, state
   - Implement RoleState interface
   - **Impact**: Cleaner architecture, easier testing

7. **Behavior Interface** (1 sprint)
   - Extract role behaviors into interfaces
   - Enable behavior composition
   - **Impact**: Less code duplication

### 5.3 Long-Term Vision

- Event sourcing for complete game replay
- Plugin architecture for extensions
- Role variant system for game modes
- Analytics dashboard for balance monitoring
- Community-driven role curation

---

## 6. Appendix: Reference Materials

### 6.1 Current Role Structure Example

**Doctor (Simple Role)**:

```typescript
export class Doctor extends Role {
  name = "Doctor";
  group = RoleGroup.Town;
  baseDefence = CombatLevel.None;
  roleblocker = false;
  nightVisitOthers = true;
  // ... other capabilities = false

  constructor(room: Room, player: Player) {
    super(room, player);
  }

  handleNightAction(recipient: Player) {
    if (recipient == this.player) {
      io.to(...).emit(..., "Cannot heal yourself");
    } else if (recipient.isAlive) {
      io.to(...).emit(..., "Healing " + recipient.username);
      this.visiting = recipient.role;
    }
  }

  visit() {
    if (this.visiting != null) {
      if (this.visiting.defence == CombatLevel.None) {
        this.visiting.defence = CombatLevel.Low;
      }
    }
  }
}
```

**Jailor (Complex Role)**:

```typescript
export class Jailor extends Role {
  name = "Jailor";
  dayVisitOthers = true; // Can jail during day
  nightVisitSelf = true; // Can execute at night

  handleMessage(message: string) {
    // Intercepts messages if someone is jailed
    if (this.dayVisiting != null) {
      // Private chat between Jailor and jailed player
    } else {
      super.handleMessage(message);
    }
  }

  handleDayAction(recipient: Player) {
    // Jail logic
  }

  handleNightAction(recipient: Player) {
    // Execute logic
  }
}
```

### 6.2 Event Types Reference

| Event             | Direction | Payload                     | Purpose                              |
| ----------------- | --------- | --------------------------- | ------------------------------------ |
| AssignPlayerRole  | S→C       | PlayerReturned              | Give player their role on game start |
| UpdateFactionRole | S→C       | {name, role}                | Reveal faction member's role         |
| UpdateDayTime     | S→C       | {time, dayNumber, timeLeft} | Sync phase/time                      |
| HandleVisit       | C→S       | {recipient, isDay}          | Submit night/day action              |
| HandleVote        | C→S       | {recipient, isDay}          | Submit vote                          |

### 6.3 Power Values Rationale

| Role              | Power | Rationale                                  |
| ----------------- | ----- | ------------------------------------------ |
| Jailor            | 12    | Can eliminate anyone + prevent all actions |
| MAFIA_ROLEBLOCKER | -20   | Can disable any role + kill                |
| Doctor            | 5     | Can protect but requires targeting         |
| Sniper            | -10   | Can shoot once per game                    |

---

**Document Version**: 1.0  
**Last Updated**: 2024-05-01  
**Author**: Architecture Analysis Team  
**Status**: Final Review Ready
