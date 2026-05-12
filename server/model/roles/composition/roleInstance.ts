import { MessageKey } from "@mernmafia/shared/communication/messages";
import type { Player } from "../../player/player.js";
import { Role } from "../abstractRole.js";
import type { RoleDefinition } from "./roleDefinition.js";
import { RoleTrait } from "./roleTraits.js";
import type { RoleHandler } from "./handlers/types.js";
import { actorNotice, dispatchNotice } from "./handlers/notices.js";
import { handled, isTerminalCommandResult } from "./handlers/results.js";

export class RoleInstance extends Role {
  readonly definition: RoleDefinition;
  readonly roleId: string;
  readonly traits: Set<RoleTrait>;

  private readonly handlers: RoleHandler[];

  constructor(definition: RoleDefinition, room: Role["room"], player: Player) {
    super(room, player);
    this.definition = definition;
    this.roleId = definition.id;
    this.traits = new Set(definition.traits);
    const handlerDefinitions =
      typeof definition.handlers === "function"
        ? definition.handlers()
        : definition.handlers;
    this.handlers = [...handlerDefinitions].sort(
      (a, b) => (a.priority ?? 100) - (b.priority ?? 100),
    );

    this.name = definition.metadata.name;
    this.group = definition.metadata.group;
    this.baseDefence = definition.combat.baseDefence;
    this.defence = definition.combat.baseDefence;
    Object.assign(this, definition.capabilities);

    this.roleblocker = this.traits.has(RoleTrait.Roleblocker);
    this.handlers.forEach((handler) =>
      handler.onAttach?.({ role: this, room: this.room }),
    );
  }

  hasTrait(trait: RoleTrait): boolean {
    return this.traits.has(trait);
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
        handled
      ) {
        return;
      }
    }
    super.handleMessage(message);
  }

  override handleDayAction(recipient: Player): void {
    for (const handler of this.handlers) {
      const result = handler.onDayCommand?.({
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
    for (const handler of this.handlers) {
      const result = handler.onNightCommand?.({
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
    for (const handler of this.handlers) {
      const result = handler.onNightVote?.({
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

  override onNightCleanup(): void {
    super.onNightCleanup();
    for (const handler of this.handlers) {
      handler.onNightCleanup?.({ role: this, room: this.room });
    }
  }

  override onPlayerVotedOut(votedOut: Role): void {
    for (const handler of this.handlers) {
      handler.onPlayerVotedOut?.({ role: this, votedOut, room: this.room });
    }
  }

  override onNoDeathDraw(): void {
    for (const handler of this.handlers) {
      handler.onNoDeathDraw?.({ role: this, room: this.room });
    }
  }
}
