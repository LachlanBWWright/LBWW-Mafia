# Custom Roles Implementation: Composition-Based Approach

## Overview

This document details the design for enabling user-created custom roles in the frontend while maintaining minimal changes to the existing role system. A composition-based approach allows custom roles to be built from reusable action handlers without modifying existing role classes.

---

## 1. Design Philosophy

### 1.1 Non-Invasive Architecture

**Principle**: Existing roles (Doctor, Jailor, Mafia, etc.) remain unchanged. Custom roles are built using a new composition system that sits alongside the inheritance hierarchy.

**Current State**:

```
Role (abstract base)
├── Doctor
├── Jailor
├── Mafia
└── ... 19 more roles
```

**Proposed State**:

```
Role (abstract base)
├── Doctor (unchanged)
├── Jailor (unchanged)
├── ... 22 more roles (unchanged)
└── DynamicRole (new - used only for custom roles)
    └── Composes ActionHandlers
        ├── VisitActionHandler
        ├── VoteActionHandler
        └── CustomActionHandler (user-defined)
```

### 1.2 Composition Over Inheritance

Instead of creating a deep hierarchy of Role subclasses, custom roles **compose** action handlers:

```typescript
// Example: Custom "Protector" role
const protectorRole = {
  metadata: { name: "Protector", faction: "town", ... },
  actionHandlers: [
    NightVisitHandler,  // Can visit at night
    ProtectiveActionHandler,  // Applies healing
  ],
};
```

---

## 2. Core Composition System

### 2.1 Action Handler Interface

```typescript
// roles/composition/actionHandler.ts

export interface ActionHandler {
  /**
   * Called when this handler is attached to a role.
   * Use for initialization and configuration.
   */
  attach?(role: Role): void;

  /**
   * Validates if an action can be performed.
   * Returns validation errors if invalid.
   */
  validate?(context: ActionContext): ValidationError[];

  /**
   * Executes the action. Called after validation passes.
   */
  execute(context: ActionContext): void;

  /**
   * Called when the action visit/target is finalized.
   * Applies the actual game effect.
   */
  apply?(context: ApplyContext): void;

  /**
   * Cleans up state at end of phase.
   */
  cleanup?(phase: GamePhase): void;
}

export type ActionContext = {
  actor: Role;
  target: Player | null;
  phase: GamePhase;
  time: DayTime;
  room: Room;
};

export type ApplyContext = ActionContext & {
  targetRole: Role;
};
```

### 2.2 Built-in Action Handlers

#### **VisitActionHandler** (Base for targeting actions)

```typescript
// roles/composition/handlers/visitActionHandler.ts

export class VisitActionHandler implements ActionHandler {
  constructor(
    private phase: "day" | "night",
    private targetType: "self" | "others" | "faction",
  ) {}

  attach(role: Role) {
    // Update role capabilities based on phase/targetType
    if (this.phase === "day") {
      if (this.targetType === "self") role.dayVisitSelf = true;
      if (this.targetType === "others") role.dayVisitOthers = true;
      if (this.targetType === "faction") role.dayVisitFaction = true;
    } else {
      if (this.targetType === "self") role.nightVisitSelf = true;
      if (this.targetType === "others") role.nightVisitOthers = true;
      if (this.targetType === "faction") role.nightVisitFaction = true;
    }
  }

  validate(context: ActionContext): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!context.actor.player.isAlive) {
      errors.push({ code: "ACTOR_DEAD", message: "You are dead" });
    }
    if (context.target && !context.target.isAlive) {
      errors.push({ code: "TARGET_DEAD", message: "Target is dead" });
    }
    if (context.actor.player === context.target) {
      errors.push({ code: "SELF_TARGET", message: "Cannot target yourself" });
    }

    return errors;
  }

  execute(context: ActionContext) {
    if (!context.target) return;

    context.actor.visiting = context.target.role;
    io.to(context.actor.player.user.socketId).emit(
      ServerEvent.ReceiveMessage,
      `You targeted ${context.target.username}`,
    );
  }
}
```

#### **ProtectiveActionHandler** (Healing/Defense effect)

```typescript
// roles/composition/handlers/protectiveActionHandler.ts

export class ProtectiveActionHandler implements ActionHandler {
  constructor(private defenseLevel: CombatLevel = CombatLevel.Low) {}

  apply(context: ApplyContext): void {
    const currentDefense = context.targetRole.defence;
    context.targetRole.defence = Math.max(currentDefense, this.defenseLevel);
  }
}
```

#### **AggressiveActionHandler** (Attack/Kill effect)

```typescript
// roles/composition/handlers/aggressiveActionHandler.ts

export class AggressiveActionHandler implements ActionHandler {
  constructor(
    private damageLevel: CombatLevel = CombatLevel.High,
    private executeImmediately: boolean = false,
  ) {}

  attach(role: Role) {
    // Aggressive actions are typically night-only
    role.nightVisitOthers = true;
  }

  apply(context: ApplyContext): void {
    context.targetRole.attackers.push(context.actor);
    context.targetRole.damage = Math.max(
      context.targetRole.damage,
      this.damageLevel,
    );
  }
}
```

#### **InvestigativeActionHandler** (Info-gathering effect)

```typescript
// roles/composition/handlers/investigativeActionHandler.ts

export class InvestigativeActionHandler implements ActionHandler {
  constructor(
    private infoType: "role" | "faction" | "alignment",
    private accuracyPercent: number = 100,
  ) {}

  apply(context: ApplyContext): void {
    const info = this.gatherInfo(context.targetRole, context.infoType);
    const isAccurate = Math.random() * 100 <= this.accuracyPercent;

    const message = isAccurate
      ? `${context.target?.username} is ${info}`
      : `Random player is ${info}`;

    io.to(context.actor.player.user.socketId).emit(
      ServerEvent.ReceiveChatMessage,
      message,
    );
  }

  private gatherInfo(role: Role, type: string): string {
    // Implementation details
    if (type === "role") return role.name;
    if (type === "faction")
      return role.faction?.memberList.length > 0 ? "aligned" : "unaligned";
    return "town"; // simplified
  }
}
```

#### **VoteActionHandler** (Voting capability)

```typescript
// roles/composition/handlers/voteActionHandler.ts

export class VoteActionHandler implements ActionHandler {
  constructor(private allowedDuringNight: boolean = false) {}

  attach(role: Role) {
    if (this.allowedDuringNight) {
      role.nightVote = true;
    }
  }
}
```

---

## 3. Dynamic Role System

### 3.1 Dynamic Role Class

A single `DynamicRole` class that can host any combination of action handlers:

```typescript
// roles/dynamicRole.ts

export class DynamicRole extends Role {
  private handlers: ActionHandler[] = [];

  readonly metadata: RoleMetadata;

  constructor(
    room: Room,
    player: Player,
    metadata: RoleMetadata,
    handlers: ActionHandler[],
  ) {
    super(room, player);

    this.metadata = metadata;
    this.handlers = handlers;
    this.name = metadata.name;
    this.group = metadata.faction as any;
    this.baseDefence = CombatLevel.None;
    this.roleblocker = false;

    // Default all capabilities to false
    this.dayVisitSelf = false;
    this.dayVisitOthers = false;
    this.dayVisitFaction = false;
    this.nightVisitSelf = false;
    this.nightVisitOthers = false;
    this.nightVisitFaction = false;
    this.nightVote = false;

    // Attach handlers to customize capabilities
    this.handlers.forEach((handler) => handler.attach?.(this));
  }

  initRole() {
    this.handlers.forEach((handler) => handler.attach?.(this));
  }

  handleDayAction(recipient: Player) {
    const context: ActionContext = {
      actor: this,
      target: recipient,
      phase: GamePhase.Day,
      time: DayTime.Day,
      room: this.room,
    };

    for (const handler of this.handlers) {
      const errors = handler.validate?.(context) ?? [];
      if (errors.length > 0) {
        io.to(this.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          errors[0].message,
        );
        return;
      }

      handler.execute?.(context);
    }
  }

  handleNightAction(recipient: Player) {
    const context: ActionContext = {
      actor: this,
      target: recipient,
      phase: GamePhase.Night,
      time: DayTime.Night,
      room: this.room,
    };

    for (const handler of this.handlers) {
      const errors = handler.validate?.(context) ?? [];
      if (errors.length > 0) {
        io.to(this.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          errors[0].message,
        );
        return;
      }

      handler.execute?.(context);
    }
  }

  visit() {
    if (this.visiting != null) {
      const context: ApplyContext = {
        actor: this,
        target: this.visiting.player,
        targetRole: this.visiting,
        phase: this.room.time as any,
        time: this.room.time === GamePhase.Day ? DayTime.Day : DayTime.Night,
        room: this.room,
      };

      for (const handler of this.handlers) {
        handler.apply?.(context);
      }
    }
  }

  cleanup(phase: GamePhase) {
    this.handlers.forEach((handler) => handler.cleanup?.(phase));
  }
}
```

### 3.2 Custom Role Factory

Converts database custom role definitions into DynamicRole instances:

```typescript
// roles/customRoleFactory.ts

export class CustomRoleFactory {
  static createRole(
    room: Room,
    player: Player,
    customRoleDef: CustomRoleDefinition,
  ): DynamicRole {
    const handlers = this.buildHandlers(customRoleDef);
    return new DynamicRole(room, player, customRoleDef.metadata, handlers);
  }

  private static buildHandlers(def: CustomRoleDefinition): ActionHandler[] {
    const handlers: ActionHandler[] = [];

    // Visit capabilities → handlers
    if (def.metadata.capabilities.dayVisitOthers) {
      handlers.push(new VisitActionHandler("day", "others"));
    }
    if (def.metadata.capabilities.nightVisitOthers) {
      handlers.push(new VisitActionHandler("night", "others"));
    }

    // Action effects → handlers
    if (def.effects?.heal) {
      handlers.push(new ProtectiveActionHandler(def.effects.heal.defensLevel));
    }
    if (def.effects?.damage) {
      handlers.push(new AggressiveActionHandler(def.effects.damage.level));
    }
    if (def.effects?.investigate) {
      handlers.push(
        new InvestigativeActionHandler(
          def.effects.investigate.type,
          def.effects.investigate.accuracyPercent,
        ),
      );
    }

    // Custom handlers if provided
    if (def.customHandlerClass) {
      handlers.push(new def.customHandlerClass());
    }

    return handlers;
  }
}

export type CustomRoleDefinition = {
  metadata: RoleMetadata;
  effects?: {
    heal?: { defenseLevel: CombatLevel };
    damage?: { level: CombatLevel };
    investigate?: { type: "role" | "faction"; accuracyPercent: number };
  };
  customHandlerClass?: new () => ActionHandler;
};
```

---

## 4. Scratch-Like Interface for Action Handling

### 4.1 Vision: Block-Based Action Builder

For non-technical users to create custom role actions without writing code, a visual block-based interface similar to Scratch or Blockly would allow composing action handlers:

```
┌─────────────────────────────────────┐
│ Custom Role Builder                  │
├─────────────────────────────────────┤
│                                     │
│ Role Name: [Mystic Healer ____]    │
│ Faction:   [Town ▼]                │
│ Power Value: [5 slider]            │
│                                     │
│ ── Action Blocks ──                │
│                                     │
│ ┌─────────────────────────────┐    │
│ │ Night Visit Others    ✓     │ X  │ ← VisitActionHandler
│ └─────────────────────────────┘    │
│                                     │
│ ┌─────────────────────────────┐    │
│ │ Heal Target                 │ X  │ ← ProtectiveActionHandler
│ │ Defense Level: [Low ▼]      │    │
│ └─────────────────────────────┘    │
│                                     │
│ ┌─────────────────────────────┐    │
│ │ + Add Action Block  ▼       │    │
│ │   - Visit                   │    │
│ │   - Protect                 │    │
│ │   - Damage                  │    │
│ │   - Investigate             │    │
│ │   - Custom (Advanced)       │    │
│ └─────────────────────────────┘    │
│                                     │
│ [Preview] [Save] [Cancel]          │
└─────────────────────────────────────┘
```

### 4.2 Block Types (Future UI Components)

**Visit Block**:

```
┌────────────────────────────┐
│ 🔗 [Day/Night] Visit       │
│   [Self/Others/Faction]    │
└────────────────────────────┘
```

**Effect Block**:

```
┌────────────────────────────┐
│ ⚡ [Heal/Damage/Info]      │
│   [Parameters...]          │
└────────────────────────────┘
```

**Conditional Block**:

```
┌────────────────────────────┐
│ ◆ If [condition]           │
│   Then [action]            │
│   Else [action]            │
└────────────────────────────┘
```

### 4.3 Implementation Strategy

**Phase 1** (MVP): Simple form-based UI

- Dropdowns/checkboxes for capabilities
- Select effects from predefined list
- Text fields for metadata

**Phase 2**: Drag-and-drop block builder

- Visual block composition
- Conditions and branching
- Real-time validation

**Phase 3**: Advanced scripting

- Custom handler code editor
- Type-safe handler development
- Publish community handlers

---

## 5. Database Schema for Custom Roles

```typescript
export const customRoles = createTable("custom_role", () => ({
  id: serial("id").primaryKey(),
  creatorId: varchar("creator_id", { length: 255 })
    .notNull()
    .references(() => users.id),

  // Metadata
  name: varchar("name", { length: 255 }).notNull().unique(),
  faction: varchar("faction", { length: 50 }).notNull(),
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

  // Effects JSON
  effects: text("effects"), // JSON: { heal?, damage?, investigate? }

  // Balance
  powerValue: integer("power_value").default(0),
  isUnique: boolean("is_unique").default(false),

  // Status
  isPublished: boolean("is_published").default(false),
  approvedBy: varchar("approved_by_id").references(() => users.id),

  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
}));
```

---

## 6. Integration with Existing System

### 6.1 RoleHandler Integration

Update `RoleHandler` to support custom roles without changing built-in role logic:

```typescript
// server/model/rooms/initRoles/roleHandler.ts (modified)

export class RoleHandler {
  private customRoles: CustomRoleDefinition[] = [];

  constructor(roomSize: number, customRoles?: CustomRoleDefinition[]) {
    this.roomSize = roomSize;
    this.customRoles = customRoles || [];
  }

  assignGame(): (typeof BlankRole)[] {
    // Existing logic for built-in roles unchanged
    let roleList: (typeof BlankRole)[] = [];
    let comparativePower = 0;

    // ... existing role selection logic ...

    // At the end, convert any custom role selections to DynamicRole
    return roleList.map((RoleClass) => {
      if (RoleClass === CustomRoleMarker) {
        // Instead return DynamicRole class indicator
        return DynamicRole as any;
      }
      return RoleClass;
    });
  }

  instantiateRole(
    RoleClass: typeof BlankRole | typeof DynamicRole,
    room: Room,
    player: Player,
    customRoleDef?: CustomRoleDefinition,
  ): Role {
    if (RoleClass === DynamicRole && customRoleDef) {
      return CustomRoleFactory.createRole(room, player, customRoleDef);
    }
    return new RoleClass(room, player);
  }
}
```

### 6.2 Game Room Integration

```typescript
// server/model/rooms/room.ts (modified)

async startGame() {
  const roleHandler = new RoleHandler(this.userList.length);
  const roleClasses = roleHandler.assignGame();

  // Optionally load custom roles if configured
  let customRoleDefs: CustomRoleDefinition[] = [];
  if (this.roomSettings?.allowCustomRoles) {
    customRoleDefs = await loadPublishedCustomRoles();
  }

  for (const [index, user] of this.userList.entries()) {
    const player = new Player(user);
    this.playerList.push(player);

    const RoleClass = roleClasses[index];
    const customRoleDef = customRoleDefs[index];

    const role = roleHandler.instantiateRole(
      RoleClass,
      this,
      player,
      customRoleDef,
    );
    player.assignRole(role);

    // Rest of game start logic unchanged
  }
}
```

---

## 7. Example Custom Roles (Composable)

### 7.1 Example 1: Simple Healer

```typescript
const healerDef: CustomRoleDefinition = {
  metadata: {
    name: "Healer",
    faction: "town",
    category: "Town Protective",
    summary: "Heal one player each night",
    description:
      "Choose a player to heal at night, protecting them from damage.",
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
  },
  effects: {
    heal: { defenseLevel: CombatLevel.Low },
  },
};

// Automatically creates DynamicRole with:
// - VisitActionHandler("night", "others")
// - ProtectiveActionHandler(CombatLevel.Low)
```

### 7.2 Example 2: Accurate Investigator

```typescript
const accurateInvestigatorDef: CustomRoleDefinition = {
  metadata: {
    name: "Accurate Investigator",
    faction: "town",
    category: "Town Investigative",
    summary: "Investigate player roles with high accuracy",
    description:
      "At night, investigate a player and learn their role with 90% accuracy.",
    powerValue: 6,
    isUnique: false,
    capabilities: {
      dayVisitSelf: false,
      dayVisitOthers: false,
      dayVisitFaction: false,
      nightVisitSelf: false,
      nightVisitOthers: true,
      nightVisitFaction: false,
    },
  },
  effects: {
    investigate: { type: "role", accuracyPercent: 90 },
  },
};

// Automatically creates DynamicRole with:
// - VisitActionHandler("night", "others")
// - InvestigativeActionHandler("role", 90)
```

### 7.3 Example 3: Custom Hybrid Handler

For more complex custom roles, users can provide a custom handler:

```typescript
// Custom handler provided by advanced user
class ConfusionHandler implements ActionHandler {
  attach(role: Role) {
    role.nightVisitOthers = true;
  }

  apply(context: ApplyContext): void {
    // Confuse target - next day their vote is random
    context.targetRole.confused = true;
  }
}

const confuserDef: CustomRoleDefinition = {
  metadata: {
    name: "Confuser",
    faction: "neutral",
    // ... other metadata
  },
  customHandlerClass: ConfusionHandler,
};
```

---

## 8. Benefits of Composition Approach

| Benefit          | Details                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| **Non-invasive** | Existing 22 roles remain unchanged; no inheritance refactoring            |
| **Extensible**   | New handlers can be added without touching existing code                  |
| **Testable**     | Each handler can be unit tested independently                             |
| **Reusable**     | Handlers are composed; Doctor and Healer both use ProtectiveActionHandler |
| **Type-safe**    | Strong TypeScript interfaces for handlers and contexts                    |
| **Flexible**     | From simple forms to advanced custom handlers                             |
| **Scalable**     | Supports 100s of user-created roles without slowdown                      |
| **Debuggable**   | Clear handler execution flow, easy to log and trace                       |

---

## 9. Implementation Phases

### Phase 1: Core Composition System (1 sprint)

- [ ] Create ActionHandler interface
- [ ] Implement built-in handlers (VisitActionHandler, ProtectiveActionHandler, etc.)
- [ ] Create DynamicRole class
- [ ] Create CustomRoleFactory
- [ ] Add unit tests for handlers

### Phase 2: Database & Backend (1 sprint)

- [ ] Add customRoles table to schema
- [ ] Create TRPC endpoints (create, list, update, delete custom roles)
- [ ] Integrate with RoleHandler and Room
- [ ] Add validation for custom role definitions

### Phase 3: Frontend Form Builder (2 sprints)

- [ ] Create custom role form component
- [ ] Implement capability checkboxes
- [ ] Implement effect dropdowns
- [ ] Add role preview
- [ ] Add save/publish workflow

### Phase 4: Block-Based UI (Future)

- [ ] Drag-and-drop block interface (like Scratch)
- [ ] Visual effect previews
- [ ] Community handler library

---

## 10. Remaining Questions

1. **Faction Assignment**: Should custom roles be able to specify faction membership rules (e.g., "Mafia-like" role that joins the Mafia faction)? Recommend: Add `factionType` to metadata.

2. **Win Conditions**: Should custom roles have custom win conditions? Recommend: MVP only supports existing win conditions (Town/Mafia/Neutral).

3. **Complex Logic**: How to handle roles requiring complex multi-turn logic (e.g., limited uses)? Recommend: Phase 4 adds stateful handler support.

4. **Role Variants**: Should users create role variants (e.g., "Doctor (Enhanced)")? Recommend: Name uniqueness prevents, but can revisit for versioning system.

5. **Moderation**: How are bad/inappropriate custom roles handled? Recommend: Admin approval workflow + community flagging system.

---

**Document Version**: 1.0  
**Status**: Ready for Implementation  
**Next Step**: Implement Phase 1 (Composition System)
