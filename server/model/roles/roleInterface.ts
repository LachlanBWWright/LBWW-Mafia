import { Room } from "../rooms/room.js";
import { Player } from "../player/player.js";
import { RoleGroup } from "./roleGroup.js";
import { CombatLevel } from "./combatLevel.js";
import { Faction } from "../factions/abstractFaction.js";
import type { Role } from "./abstractRole.js";

/**
 * Interface that all roles must implement.
 * Defines the contract for role behavior and capabilities.
 */
export interface RoleInterface {
  readonly room: Room;
  readonly player: Player;
  readonly name: string;
  readonly group: RoleGroup;

  faction?: Faction;
  baseDefence: CombatLevel;
  defence: CombatLevel;
  damage: CombatLevel;

  dayVisitSelf: boolean;
  dayVisitOthers: boolean;
  dayVisitFaction: boolean;
  nightVisitSelf: boolean;
  nightVisitOthers: boolean;
  nightVisitFaction: boolean;
  nightVote: boolean;

  attackVote?: Role | null;
  isAttacking?: boolean;
  isInsane?: boolean;
  victoryCondition?: boolean;

  dayVisiting: Role | null;
  roleblocking: Role | null;
  visiting: Role | null;
  visitors: Role[];
  attackers: Role[];

  readonly roleblocker: boolean;
  roleblocked: boolean;
  silenced: boolean;
  dayTapped: Role | boolean;
  nightTapped: Role | boolean;
  jailed: Role | null;

  assignFaction(faction: Faction): void;
  initRole(): void;
  dayUpdate(): void;
  handleMessage(message: string): void;
  handleDayAction(recipient: Player): void;
  handleNightAction(recipient: Player): void;
  visit(): void;
  receiveVisit(visitor: Role): void;
}
