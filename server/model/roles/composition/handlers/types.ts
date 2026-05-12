import type { Player } from "../../../player/player.js";
import type { GamePhase } from "../../../rooms/gamePhase.js";
import type { Room } from "../../../rooms/room.js";
import type { Role } from "../../abstractRole.js";
import type { RoleInstance } from "../roleInstance.js";
import type { CommandResult, HandlerResult } from "./results.js";

export type RoleCommandContext = {
  role: RoleInstance;
  recipient: Player;
  room: Room;
  phase: GamePhase;
};

export type RoleLifecycleContext = {
  role: RoleInstance;
  room: Room;
};

export type RoleVisitContext = {
  role: RoleInstance;
  room: Room;
};

export type RoleVisitOutcomeContext = {
  role: RoleInstance;
  room: Room;
};

export type RoleReceiveVisitContext = {
  role: RoleInstance;
  visitor: Role;
  room: Room;
};

export type RoleChatContext = {
  role: RoleInstance;
  message: string;
  room: Room;
};

export type RoleVotedOutContext = {
  role: RoleInstance;
  votedOut: Role;
  room: Room;
};

export interface RoleHandler {
  priority?: number;
  onAttach?(context: RoleLifecycleContext): void;
  onInit?(context: RoleLifecycleContext): void;
  onDayUpdate?(context: RoleLifecycleContext): void;
  onHandleMessage?(context: RoleChatContext): HandlerResult;
  onDayCommand?(context: RoleCommandContext): CommandResult;
  onNightCommand?(context: RoleCommandContext): CommandResult;
  onNightVote?(context: RoleCommandContext): CommandResult;
  onDayVisit?(context: RoleVisitContext): void;
  onNightVisit?(context: RoleVisitContext): void;
  onVisitOutcomes?(context: RoleVisitOutcomeContext): void;
  onReceiveVisit?(context: RoleReceiveVisitContext): void;
  onNightCleanup?(context: RoleLifecycleContext): void;
  onPlayerVotedOut?(context: RoleVotedOutContext): void;
  onNoDeathDraw?(context: RoleLifecycleContext): void;
}

/**
 * Backwards-compatible alias retained while imports move from the old name.
 */
export type RoleHandlerDefinition = RoleHandler;
