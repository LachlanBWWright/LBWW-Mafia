import type { GameFaction } from "../factions/factionContracts.js";
import { Player } from "../player/player.js";
import { GamePhase } from "../rooms/gamePhase.js";
import type { Room } from "../rooms/room.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import type { GameRole } from "./roleContracts.js";
import { CombatLevel } from "./combatLevel.js";
import type { RoleTrait } from "./composition/roleTraits.js";
import {
  createRoleRuntimeState,
  resetNightActionState,
  type RoleFactionAction,
  type RoleRuntimeState,
} from "./composition/roleRuntimeState.js";
import { RoleGroup } from "./roleGroup.js";
import { actorNotice, dispatchNotice } from "./composition/handlers/notices.js";

/**
 * Concrete runtime compatibility adapter used by RoleInstance.
 * New gameplay behavior should be authored via RoleDefinition/RoleHandler composition.
 */
export class Role implements GameRole {
  readonly room: Room;
  readonly player: Player;
  readonly runtimeState: RoleRuntimeState;

  name = "Role";
  group = RoleGroup.Unaligned;
  faction?: GameFaction;

  baseDefence = CombatLevel.None;

  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = false;
  nightVisitFaction = false;
  nightVote = false;

  roleblocker = false;

  /**
   * Creates a new Role instance.
   *
   * @param room - The game room this role belongs to
   * @param player - The player assigned to this role
   */
  constructor(room: Room, player: Player) {
    this.room = room;
    this.player = player;
    this.runtimeState = createRoleRuntimeState(this.baseDefence);
  }

  get defence(): CombatLevel {
    return this.runtimeState.combat.defence;
  }

  set defence(value: CombatLevel) {
    this.runtimeState.combat.defence = value;
  }

  get damage(): CombatLevel {
    return this.runtimeState.combat.damage;
  }

  set damage(value: CombatLevel) {
    this.runtimeState.combat.damage = value;
  }

  get attackVote(): GameRole | null {
    return this.runtimeState.nightAction.factionVoteTarget;
  }

  set attackVote(value: GameRole | null) {
    this.runtimeState.nightAction.factionVoteTarget = value;
  }

  get isAttacking(): boolean {
    return this.runtimeState.nightAction.isAttacking;
  }

  set isAttacking(value: boolean) {
    this.runtimeState.nightAction.isAttacking = value;
  }

  get isInsane(): boolean {
    return this.runtimeState.mentalState.isInsane;
  }

  set isInsane(value: boolean) {
    this.runtimeState.mentalState.isInsane = value;
  }

  get victoryCondition(): boolean {
    return this.runtimeState.victory.victoryCondition;
  }

  set victoryCondition(value: boolean) {
    this.runtimeState.victory.victoryCondition = value;
  }

  get dayVisiting(): GameRole | null {
    return this.runtimeState.dayAction.target;
  }

  set dayVisiting(value: GameRole | null) {
    this.runtimeState.dayAction.target = value;
  }

  get roleblocking(): GameRole | null {
    return this.runtimeState.statuses.roleblocking;
  }

  set roleblocking(value: GameRole | null) {
    this.runtimeState.statuses.roleblocking = value;
  }

  get visiting(): GameRole | null {
    return this.runtimeState.nightAction.target;
  }

  set visiting(value: GameRole | null) {
    this.runtimeState.nightAction.target = value;
  }

  get visitors(): GameRole[] {
    return this.runtimeState.combat.visitors;
  }

  set visitors(value: GameRole[]) {
    this.runtimeState.combat.visitors = value;
  }

  get attackers(): GameRole[] {
    return this.runtimeState.combat.attackers;
  }

  set attackers(value: GameRole[]) {
    this.runtimeState.combat.attackers = value;
  }

  get roleblocked(): boolean {
    return this.runtimeState.statuses.roleblocked;
  }

  set roleblocked(value: boolean) {
    this.runtimeState.statuses.roleblocked = value;
  }

  get silenced(): boolean {
    return this.runtimeState.statuses.silenced;
  }

  set silenced(value: boolean) {
    this.runtimeState.statuses.silenced = value;
  }

  get dayTappedBy(): GameRole | null {
    return this.runtimeState.statuses.dayTappedBy;
  }

  set dayTappedBy(value: GameRole | null) {
    this.runtimeState.statuses.dayTappedBy = value;
  }

  get nightTappedBy(): GameRole | null {
    return this.runtimeState.statuses.nightTappedBy;
  }

  set nightTappedBy(value: GameRole | null) {
    this.runtimeState.statuses.nightTappedBy = value;
  }

  get jailed(): GameRole | null {
    return this.runtimeState.statuses.jailedBy;
  }

  set jailed(value: GameRole | null) {
    this.runtimeState.statuses.jailedBy = value;
  }

  getPersistentCharge(slot: string, initialValue = 0): number {
    if (!(slot in this.runtimeState.persistent.charges)) {
      this.runtimeState.persistent.charges[slot] = initialValue;
    }
    return this.runtimeState.persistent.charges[slot] ?? initialValue;
  }

  setPersistentCharge(slot: string, value: number): void {
    this.runtimeState.persistent.charges[slot] = value;
  }

  getPersistentTarget(slot: string): GameRole | null {
    return this.runtimeState.persistent.targets[slot] ?? null;
  }

  setPersistentTarget(slot: string, target: GameRole | null): void {
    this.runtimeState.persistent.targets[slot] = target;
  }

  getPersistentFlag(slot: string): boolean {
    return this.runtimeState.persistent.flags[slot] ?? false;
  }

  setPersistentFlag(slot: string, value: boolean): void {
    this.runtimeState.persistent.flags[slot] = value;
  }

  setFactionAction(action: RoleFactionAction | null): void {
    this.runtimeState.nightAction.factionAction = action;
    this.isAttacking = action?.kind === "attack";
  }

  peekFactionAction(): RoleFactionAction | null {
    return this.runtimeState.nightAction.factionAction;
  }

  consumeFactionAction(expectedKind?: RoleFactionAction["kind"]): RoleFactionAction | null {
    const action = this.runtimeState.nightAction.factionAction;
    if (!action) {
      return null;
    }
    if (expectedKind && action.kind !== expectedKind) {
      return null;
    }
    this.runtimeState.nightAction.factionAction = null;
    this.isAttacking = false;
    return action;
  }

  resetNightState(): void {
    resetNightActionState(this.runtimeState, this.baseDefence);
  }

  /**
   * Assigns this role to a faction.
   *
   * @param faction - The faction to assign
   * @returns
   */
  assignFaction(faction: GameFaction) {
    this.faction = faction;
  }

  hasTrait(_trait: RoleTrait): boolean {
    return false;
  }

  /**
   * Initializes the role at game start. Override in subclasses for role-specific setup.
   *
   * @returns
   */
  initRole() {}

  /**
   * Called at the start of each day phase. Override in subclasses for role-specific logic.
   *
   * @returns
   */
  dayUpdate() {}

  /**
   * Handles incoming chat messages based on the current game phase.
   * Silenced players are notified, day phase messages are broadcast, and night messages are faction-scoped.
   *
   * @param message - The chat message content
   * @returns
   */
  handleMessage(message: string) {
    if (this.room.systems?.chat) {
      this.room.systems.chat.handleRoleMessage(this, message);
      return;
    }

    if (this.room.time === GamePhase.Day && !this.silenced) {
      this.room.messenger.emitToRoom(
        ServerEvent.ReceiveChatMessage,
        `${this.player.username}: ${message}`,
      );
      return;
    }

    dispatchNotice(
      this,
      actorNotice({
        key:
          this.room.time === GamePhase.Day
            ? MessageKey.SilencedCannotTalk
            : MessageKey.CannotSpeakAtNight,
      }),
    );
  }

  /**
   * Handles a daytime action on a target player. Override in subclasses for role-specific logic.
   * Default implementation sends a message indicating the role has no day action.
   *
   * @param _recipient - The target player (not used in base implementation)
   * @returns
   */
  handleDayAction(_recipient: Player) {
    if (this.room.systems?.chat) {
      this.room.systems.chat.sendActorNotice(this.player, {
        key: MessageKey.NoDayAction,
      });
      return;
    }
    dispatchNotice(this, actorNotice({ key: MessageKey.NoDayAction }));
  }

  /**
   * Cancels the player's current day action visit and notifies them.
   *
   * @returns
   */
  cancelDayAction() {
    if (this.room.systems?.chat) {
      this.room.systems.chat.sendActorNotice(this.player, {
        key: MessageKey.CancelledDayAction,
      });
    } else {
      dispatchNotice(this, actorNotice({ key: MessageKey.CancelledDayAction }));
    }
    this.dayVisiting = null;
  }

  /**
   * Handles a nighttime action on a target player. Override in subclasses for role-specific logic.
   * Default implementation sends a message indicating the role has no night action.
   *
   * @param _recipient - The target player (not used in base implementation)
   * @returns
   */
  handleNightAction(_recipient: Player) {
    if (this.room.systems?.chat) {
      this.room.systems.chat.sendActorNotice(this.player, {
        key: MessageKey.NoNightAction,
      });
      return;
    }
    dispatchNotice(this, actorNotice({ key: MessageKey.NoNightAction }));
  }

  /**
   * Handles a nighttime factional vote. Override in subclasses for role-specific logic.
   * Default implementation sends a message indicating the role has no night voting.
   *
   * @param _recipient - The target player (not used in base implementation)
   * @returns
   */
  handleNightVote(_recipient: Player) {
    if (this.room.systems?.chat) {
      this.room.systems.chat.sendActorNotice(this.player, {
        key: MessageKey.NoNightVote,
      });
      return;
    }
    dispatchNotice(this, actorNotice({ key: MessageKey.NoNightVote }));
  }

  /**
   * Cancels the player's current night action visit and notifies them.
   *
   * @returns
   */
  cancelNightAction() {
    if (this.room.systems?.chat) {
      this.room.systems.chat.sendActorNotice(this.player, {
        key: MessageKey.CancelledNightAction,
      });
    } else {
      dispatchNotice(this, actorNotice({ key: MessageKey.CancelledNightAction }));
    }
    this.visiting = null;
  }

  /**
   * Registers that another role is visiting this role.
   *
   * @param role - The role that is visiting
   * @returns
   */
  receiveVisit(role: GameRole) {
    this.visitors.push(role);
  }

  /**
   * Processes incoming damage based on this role's defense.
   * If damage exceeds defense, the player dies. Otherwise, damage is reset at end of phase.
   * Notifies the player and broadcasts their death if applicable.
   *
   * @returns True if the player died, false otherwise
   */
  handleDamage() {
    return this.room.systems?.combat.resolveRoleDamage(this) ?? false;
  }

  /**
   * Processes daytime visits. Override in subclasses for role-specific logic.
   *
   * @returns
   */
  dayVisit() {}

  /**
   * Processes nighttime visits. Override in subclasses for role-specific logic.
   *
   * @returns
   */
  visit() {}

  /**
   * Called when another role visits this role during daytime. Override in subclasses for role-specific logic.
   *
   * @param _role - The role that is visiting
   * @returns
   */
  receiveDayVisit(_role: GameRole) {}

  /**
   * Processes all daytime visits to this role. Override in subclasses for role-specific logic.
   *
   * @returns
   */
  handleDayVisits() {}

  /**
   * Processes all nighttime visits to this role. Override in subclasses for role-specific logic.
   *
   * @returns
   */
  handleVisits() {}

  onNightCleanup(): void {
    this.resetNightState();
  }

  onPlayerVotedOut(_votedOut: GameRole): void {}

  onNoDeathDraw(): void {}
}
