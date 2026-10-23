import type { Player } from "../../player/player.js";

export type VisitResolutionStage = "preVisit" | "visit" | "postVisit";

export type VisitResolutionStep = {
  stage: VisitResolutionStage;
  player: Player;
};

export function buildVisitResolutionPlan(
  players: readonly Player[],
): VisitResolutionStep[] {
  const preVisitSteps = players
    .filter((player) => player.role.roleblocker)
    .map((player) => ({ stage: "preVisit" as const, player }));
  const visitSteps = players
    .filter((player) => !player.role.roleblocker)
    .map((player) => ({ stage: "visit" as const, player }));
  const postVisitSteps = players
    .filter((player) => player.isAlive)
    .map((player) => ({ stage: "postVisit" as const, player }));

  return [...preVisitSteps, ...visitSteps, ...postVisitSteps];
}
