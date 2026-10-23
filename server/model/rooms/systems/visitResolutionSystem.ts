import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import type { Room } from "../room.js";
import { buildVisitResolutionPlan } from "./visitResolution.js";

export class VisitResolutionSystem {
  constructor(private readonly room: Room) {}

  resolveNight(): void {
    this.applyFactionIntents();
    const resolutionPlan = buildVisitResolutionPlan(this.room.playerList);

    for (const step of resolutionPlan) {
      if (step.stage === "preVisit") {
        this.processVisitor(step.player);
        continue;
      }

      if (step.stage === "visit") {
        this.processVisitor(step.player);
        continue;
      }

      step.player.role.handleVisits();
    }
  }

  private applyFactionIntents(): void {
    for (const faction of this.room.factionList) {
      for (const intent of faction.drainNightIntents()) {
        if (!intent.actor.player.isAlive || !intent.target.player.isAlive) {
          continue;
        }
        intent.actor.visiting = intent.target;
        if (intent.kind === "attack") {
          intent.actor.setFactionAction({
            kind: "attack",
            damage: intent.damage,
          });
        } else {
          intent.actor.setFactionAction({ kind: "forced-visit" });
        }
      }
    }
  }

  private processVisitor(player: Room["playerList"][number]): void {
    if (!player.isAlive) return;
    if (player.role.roleblocked) {
      this.room.actionFeedback(
        player,
        "Your night action was blocked.",
        "blocked",
      );
      player.role.visiting = null;
      this.room.messenger.emitToPlayer(player, ServerEvent.ReceiveMessage, {
        key: MessageKey.YouWereRoleblocked,
      });
      player.role.roleblocked = false;
      return;
    }

    if (player.role.visiting !== null) {
      // Completing the attempt does not tell the actor whether a hidden
      // protection, attack, or probabilistic roleblock took effect.
      this.room.actionFeedback(
        player,
        "Your night action finished. No additional result is available.",
        "resolved",
      );
      player.role.visit();
    }
  }
}
