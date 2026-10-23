import type { Room } from "../room.js";
import { RoleCommandSystem } from "./roleCommandSystem.js";
import { FactionSystem } from "./factionSystem.js";
import { VisitResolutionSystem } from "./visitResolutionSystem.js";
import { CombatSystem } from "./combatSystem.js";
import { StatusEffectSystem } from "./statusEffectSystem.js";
import { VictorySystem } from "./victorySystem.js";
import { ChatSystem } from "./chatSystem.js";

export class GameSystems {
  readonly roleCommands: RoleCommandSystem;
  readonly factions: FactionSystem;
  readonly visits: VisitResolutionSystem;
  readonly combat: CombatSystem;
  readonly status: StatusEffectSystem;
  readonly victory: VictorySystem;
  readonly chat: ChatSystem;

  constructor(room: Room) {
    this.roleCommands = new RoleCommandSystem(room);
    this.factions = new FactionSystem(room);
    this.visits = new VisitResolutionSystem(room);
    this.combat = new CombatSystem(room);
    this.status = new StatusEffectSystem(room);
    this.victory = new VictorySystem(room);
    this.chat = new ChatSystem(room);
  }
}
