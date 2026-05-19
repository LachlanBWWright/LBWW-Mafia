import type { Player } from "../player/player.js";
import type { Room } from "../rooms/room.js";
import type { CombatLevel } from "./combatLevel.js";
import type { RoleGroup } from "./roleGroup.js";
import type { RoleTrait } from "./composition/roleTraits.js";
import type { GameFaction } from "../factions/factionContracts.js";
import type { RoleFactionAction, RoleRuntimeState } from "./composition/roleRuntimeState.js";

export interface RoleIdentity {
  readonly room: Room;
  readonly player: Player;
  readonly name: string;
  readonly group: RoleGroup;
  hasTrait(trait: RoleTrait): boolean;
}

export interface RoleCombatState {
  baseDefence: CombatLevel;
  defence: CombatLevel;
  damage: CombatLevel;
  visitors: GameRole[];
  attackers: GameRole[];
}

export interface RoleActionState {
  dayVisiting: GameRole | null;
  visiting: GameRole | null;
  attackVote: GameRole | null;
  isAttacking: boolean;
}

export interface RoleStatusState {
  readonly roleblocker: boolean;
  roleblocking: GameRole | null;
  roleblocked: boolean;
  silenced: boolean;
  dayTappedBy: GameRole | null;
  nightTappedBy: GameRole | null;
  jailed: GameRole | null;
}

export interface RoleFactionState {
  faction?: GameFaction;
  assignFaction(faction: GameFaction): void;
}

export interface RoleCommandHandlers {
  dayVisitSelf: boolean;
  dayVisitOthers: boolean;
  dayVisitFaction: boolean;
  nightVisitSelf: boolean;
  nightVisitOthers: boolean;
  nightVisitFaction: boolean;
  nightVote: boolean;
  handleMessage(message: string): void;
  handleDayAction(recipient: Player): void;
  cancelDayAction(): void;
  handleNightAction(recipient: Player): void;
  cancelNightAction(): void;
  handleNightVote(recipient: Player): void;
}

export interface RoleLifecycle {
  initRole(): void;
  dayUpdate(): void;
  visit(): void;
  dayVisit(): void;
  handleVisits(): void;
  receiveVisit(visitor: GameRole): void;
  onNightCleanup(): void;
  onPlayerVotedOut(votedOut: GameRole): void;
  onNoDeathDraw(): void;
}

export interface RoleRuntimeOperations {
  readonly runtimeState: RoleRuntimeState;
  isInsane: boolean;
  victoryCondition: boolean;
  setFactionAction(action: RoleFactionAction | null): void;
  peekFactionAction(): RoleFactionAction | null;
  consumeFactionAction(expectedKind?: RoleFactionAction["kind"]): RoleFactionAction | null;
  resetNightState(): void;
}

export type GameRole =
  RoleIdentity &
  RoleCombatState &
  RoleActionState &
  RoleStatusState &
  RoleFactionState &
  RoleCommandHandlers &
  RoleLifecycle &
  RoleRuntimeOperations;

export type ChatRole = Pick<
  GameRole,
  | "room"
  | "player"
  | "silenced"
  | "jailed"
  | "faction"
  | "nightTappedBy"
  | "handleMessage"
>;

export type CombatRole = Pick<
  GameRole,
  | "baseDefence"
  | "defence"
  | "damage"
  | "attackers"
  | "player"
  | "name"
  | "onNightCleanup"
>;

export type VisitRole = Pick<
  GameRole,
  | "roleblocker"
  | "visiting"
  | "dayVisiting"
  | "roleblocked"
  | "roleblocking"
  | "receiveVisit"
  | "visit"
  | "handleVisits"
>;
