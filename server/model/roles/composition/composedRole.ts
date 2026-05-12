import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";
import type { Player } from "../../player/player.js";
import { Role } from "../abstractRole.js";
import type { RoleDefinition } from "./roleDefinition.js";
import { RoleTrait } from "./roleTraits.js";
import type { RoleHandlerDefinition } from "./handlers/types.js";
import type { RoleRuntimeState } from "./roleRuntimeState.js";
import type { Faction } from "../../factions/abstractFaction.js";

export class ComposedRole extends Role {
  readonly definition: RoleDefinition;
  readonly roleId: string;
  readonly traits: Set<RoleTrait>;
  readonly state: RoleRuntimeState;

  private readonly handlers: RoleHandlerDefinition[];

  constructor(definition: RoleDefinition, room: Role["room"], player: Player) {
    super(room, player);
    this.definition = definition;
    this.roleId = definition.id;
    this.traits = new Set(definition.traits);
    this.handlers = [...definition.handlers].sort(
      (a, b) => (a.priority ?? 100) - (b.priority ?? 100),
    );

    this.name = definition.metadata.name;
    this.group = definition.metadata.group;
    this.baseDefence = definition.combat.baseDefence;
    this.defence = definition.combat.baseDefence;

    this.dayVisitSelf = definition.capabilities.dayVisitSelf;
    this.dayVisitOthers = definition.capabilities.dayVisitOthers;
    this.dayVisitFaction = definition.capabilities.dayVisitFaction;
    this.nightVisitSelf = definition.capabilities.nightVisitSelf;
    this.nightVisitOthers = definition.capabilities.nightVisitOthers;
    this.nightVisitFaction = definition.capabilities.nightVisitFaction;
    this.nightVote = definition.capabilities.nightVote;

    this.roleblocker = this.traits.has(RoleTrait.Roleblocker);
    this.state = {
      faction: this.faction,
      baseDefence: this.baseDefence,
      defence: this.defence,
      damage: this.damage,
      dayVisiting: this.dayVisiting,
      visiting: this.visiting,
      visitors: this.visitors,
      attackers: this.attackers,
      roleblocking: this.roleblocking,
      attackVote: this.attackVote ?? null,
      flags: {
        roleblocked: this.roleblocked,
        roleblocker: this.roleblocker,
        silenced: this.silenced,
        isAttacking: this.isAttacking ?? false,
        isInsane: this.isInsane ?? false,
        victoryCondition: this.victoryCondition ?? false,
      },
      statusRefs: {
        dayTapped: this.dayTapped,
        nightTapped: this.nightTapped,
        jailed: this.jailed,
      },
      custom: {},
    };
    this.handlers.forEach((handler) =>
      handler.onAttach?.({ role: this, room: this.room }),
    );
  }

  hasTrait(trait: RoleTrait): boolean {
    return this.traits.has(trait);
  }

  override assignFaction(faction: Faction): void {
    super.assignFaction(faction);
    this.state.faction = faction;
  }

  override initRole(): void {
    for (const handler of this.handlers) {
      handler.onInit?.({ role: this, room: this.room });
    }
  }

  override dayUpdate(): void {
    for (const handler of this.handlers) {
      handler.onDayUpdate?.({ role: this, room: this.room });
    }
  }

  override handleMessage(message: string): void {
    for (const handler of this.handlers) {
      if (
        handler.onHandleMessage?.({ role: this, room: this.room, message }) ===
        true
      ) {
        return;
      }
    }
    super.handleMessage(message);
  }

  override handleDayAction(recipient: Player): void {
    for (const handler of this.handlers) {
      if (
        handler.onDayCommand?.({
          role: this,
          recipient,
          room: this.room,
          phase: this.room.time,
        }) === true
      ) {
        return;
      }
    }
    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.NoDayAction,
    });
  }

  override handleNightAction(recipient: Player): void {
    for (const handler of this.handlers) {
      if (
        handler.onNightCommand?.({
          role: this,
          recipient,
          room: this.room,
          phase: this.room.time,
        }) === true
      ) {
        return;
      }
    }
    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.NoNightAction,
    });
  }

  override handleNightVote(recipient: Player): void {
    for (const handler of this.handlers) {
      if (
        handler.onNightVote?.({
          role: this,
          recipient,
          room: this.room,
          phase: this.room.time,
        }) === true
      ) {
        return;
      }
    }
    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.NoNightVote,
    });
  }

  override dayVisit(): void {
    for (const handler of this.handlers) {
      handler.onDayVisit?.({ role: this, room: this.room });
    }
  }

  override visit(): void {
    for (const handler of this.handlers) {
      handler.onNightVisit?.({ role: this, room: this.room });
    }
  }

  override handleVisits(): void {
    for (const handler of this.handlers) {
      handler.onVisitOutcomes?.({ role: this, room: this.room });
    }
  }

  override receiveVisit(role: Role): void {
    super.receiveVisit(role);
    for (const handler of this.handlers) {
      handler.onReceiveVisit?.({ role: this, visitor: role, room: this.room });
    }
  }

  onNightCleanup(): void {
    for (const handler of this.handlers) {
      handler.onNightCleanup?.({ role: this, room: this.room });
    }
  }

  onPlayerVotedOut(votedOut: ComposedRole): void {
    for (const handler of this.handlers) {
      handler.onPlayerVotedOut?.({ role: this, votedOut, room: this.room });
    }
  }

  onNoDeathDraw(): void {
    for (const handler of this.handlers) {
      handler.onNoDeathDraw?.({ role: this, room: this.room });
    }
  }
}
