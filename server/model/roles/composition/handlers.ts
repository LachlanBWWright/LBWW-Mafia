import {
  ActionHandler,
  ActionContext,
  ApplyContext,
  ValidationError,
} from "./types.js";
import { Role } from "../abstractRole.js";
import { CombatLevel } from "../combatLevel.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";

/**
 * Base handler for roles that can target players.
 * Enables visiting based on phase and target type.
 */
export class VisitActionHandler implements ActionHandler {
  constructor(
    private phase: "day" | "night",
    private targetType: "self" | "others" | "faction",
  ) {}

  attach(role: Role) {
    // Update role capabilities based on phase and target type
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
      errors.push({
        code: "SELF_TARGET",
        message: "Cannot target yourself",
      });
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

/**
 * Handler that applies protective/healing effects to targets.
 */
export class ProtectiveActionHandler implements ActionHandler {
  constructor(private defenseLevel: CombatLevel = CombatLevel.Low) {}

  apply(context: ApplyContext): void {
    const currentDefense = context.targetRole.defence;
    context.targetRole.defence = Math.max(currentDefense, this.defenseLevel);
  }
}

/**
 * Handler that applies aggressive/damaging effects to targets.
 */
export class AggressiveActionHandler implements ActionHandler {
  constructor(private damageLevel: CombatLevel = CombatLevel.High) {}

  attach(role: Role) {
    // Aggressive actions are typically night-only
    role.nightVisitOthers = true;
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
      errors.push({
        code: "SELF_TARGET",
        message: "Cannot target yourself",
      });
    }

    return errors;
  }

  apply(context: ApplyContext): void {
    context.targetRole.attackers.push(context.actor);
    context.targetRole.damage = Math.max(
      context.targetRole.damage,
      this.damageLevel,
    );
  }
}

/**
 * Handler that allows gathering information about targets.
 */
export class InvestigativeActionHandler implements ActionHandler {
  constructor(
    private infoType: "role" | "faction" | "alignment",
    private accuracyPercent: number = 100,
  ) {}

  attach(role: Role) {
    role.nightVisitOthers = true;
  }

  validate(context: ActionContext): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!context.actor.player.isAlive) {
      errors.push({ code: "ACTOR_DEAD", message: "You are dead" });
    }

    if (context.target && !context.target.isAlive) {
      errors.push({ code: "TARGET_DEAD", message: "Target is dead" });
    }

    return errors;
  }

  apply(context: ApplyContext): void {
    const info = this.gatherInfo(context.targetRole, this.infoType);
    const isAccurate = Math.random() * 100 <= this.accuracyPercent;

    const message = isAccurate
      ? `${context.target?.username} is ${info}`
      : this.getRandomInfo();

    io.to(context.actor.player.user.socketId).emit(
      ServerEvent.ReceiveChatMessage,
      message,
    );
  }

  private gatherInfo(
    role: Role,
    type: "role" | "faction" | "alignment",
  ): string {
    if (type === "role") return role.name;
    if (type === "alignment")
      return role.faction ? "mafia aligned" : "town aligned";
    return "unaligned"; // faction type info
  }

  private getRandomInfo(): string {
    const info = ["town aligned", "mafia aligned", "unaligned"];
    return info[Math.floor(Math.random() * info.length)];
  }
}

/**
 * Handler that enables voting capabilities.
 */
export class VoteActionHandler implements ActionHandler {
  constructor(private allowedDuringNight: boolean = false) {}

  attach(role: Role) {
    if (this.allowedDuringNight) {
      role.nightVote = true;
    }
  }
}
