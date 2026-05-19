import { MessageKey } from "@mernmafia/shared/communication/messages";
import type { Player } from "../../player/player.js";
import { Role } from "../abstractRole.js";
import type { RoleCapabilities, RoleDefinition } from "./roleDefinition.js";
import { RoleTrait } from "./roleTraits.js";
import {
  type RoleHandlerBuckets,
} from "./handlers/types.js";
import { actorNotice, dispatchNotice } from "./handlers/notices.js";
import { handled, isTerminalCommandResult } from "./handlers/results.js";

export class RoleInstance extends Role {
  readonly definition: RoleDefinition;
  readonly roleId: string;
  readonly traits: Set<RoleTrait>;

  private readonly handlers: RoleHandlerBuckets;

  constructor(definition: RoleDefinition, room: Role["room"], player: Player) {
    super(room, player);
    this.definition = definition;
    this.roleId = definition.id;
    this.traits = new Set(definition.traits);
    this.handlers = definition.handlers;

    this.name = definition.metadata.name;
    this.group = definition.metadata.group;
    this.baseDefence = definition.combat.baseDefence;
    this.defence = definition.combat.baseDefence;
    applyCapabilities(this, definition.capabilities);

    this.roleblocker = this.traits.has(RoleTrait.Roleblocker);
    for (const handler of this.handlers.onAttach) {
      handler({ role: this, room: this.room });
    }
  }

  hasTrait(trait: RoleTrait): boolean {
    return this.traits.has(trait);
  }

  override initRole(): void {
    for (const handler of this.handlers.onInit) {
      handler({ role: this, room: this.room });
    }
  }

  override dayUpdate(): void {
    for (const handler of this.handlers.onDayUpdate) {
      handler({ role: this, room: this.room });
    }
  }

  override handleMessage(message: string): void {
    for (const handler of this.handlers.onHandleMessage) {
      if (handler({ role: this, room: this.room, message }) === handled) {
        return;
      }
    }
    super.handleMessage(message);
  }

  override handleDayAction(recipient: Player): void {
    for (const handler of this.handlers.onDayCommand) {
      const result = handler({
        role: this,
        recipient,
        room: this.room,
        phase: this.room.time,
      });
      if (isTerminalCommandResult(result)) {
        return;
      }
    }
    dispatchNotice(this, actorNotice({ key: MessageKey.NoDayAction }));
  }

  override handleNightAction(recipient: Player): void {
    for (const handler of this.handlers.onNightCommand) {
      const result = handler({
        role: this,
        recipient,
        room: this.room,
        phase: this.room.time,
      });
      if (isTerminalCommandResult(result)) {
        return;
      }
    }
    dispatchNotice(this, actorNotice({ key: MessageKey.NoNightAction }));
  }

  override handleNightVote(recipient: Player): void {
    for (const handler of this.handlers.onNightVote) {
      const result = handler({
        role: this,
        recipient,
        room: this.room,
        phase: this.room.time,
      });
      if (isTerminalCommandResult(result)) {
        return;
      }
    }
    dispatchNotice(this, actorNotice({ key: MessageKey.NoNightVote }));
  }

  override dayVisit(): void {
    for (const handler of this.handlers.onDayVisit) {
      handler({ role: this, room: this.room });
    }
  }

  override visit(): void {
    for (const handler of this.handlers.onNightVisit) {
      handler({ role: this, room: this.room });
    }
  }

  override handleVisits(): void {
    for (const handler of this.handlers.onVisitOutcomes) {
      handler({ role: this, room: this.room });
    }
  }

  override receiveVisit(role: Role): void {
    super.receiveVisit(role);
    for (const handler of this.handlers.onReceiveVisit) {
      handler({ role: this, visitor: role, room: this.room });
    }
  }

  override onNightCleanup(): void {
    super.onNightCleanup();
    for (const handler of this.handlers.onNightCleanup) {
      handler({ role: this, room: this.room });
    }
  }

  override onPlayerVotedOut(votedOut: Role): void {
    for (const handler of this.handlers.onPlayerVotedOut) {
      handler({ role: this, votedOut, room: this.room });
    }
  }

  override onNoDeathDraw(): void {
    for (const handler of this.handlers.onNoDeathDraw) {
      handler({ role: this, room: this.room });
    }
  }
}

function applyCapabilities(role: Role, capabilities: RoleCapabilities): void {
  role.dayVisitSelf = capabilities.dayVisitSelf;
  role.dayVisitOthers = capabilities.dayVisitOthers;
  role.dayVisitFaction = capabilities.dayVisitFaction;
  role.nightVisitSelf = capabilities.nightVisitSelf;
  role.nightVisitOthers = capabilities.nightVisitOthers;
  role.nightVisitFaction = capabilities.nightVisitFaction;
  role.nightVote = capabilities.nightVote;
}
