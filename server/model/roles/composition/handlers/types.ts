import type { Player } from "../../../player/player.js";
import type { GamePhase } from "../../../rooms/gamePhase.js";
import type { Room } from "../../../rooms/room.js";
import type { Role } from "../../abstractRole.js";
import type { ComposedRole } from "../composedRole.js";

export type RoleCommandContext = {
  role: ComposedRole;
  recipient: Player;
  room: Room;
  phase: GamePhase;
};

export type RoleLifecycleContext = {
  role: ComposedRole;
  room: Room;
};

export type RoleVisitContext = {
  role: ComposedRole;
  room: Room;
};

export type RoleVisitOutcomeContext = {
  role: ComposedRole;
  room: Room;
};

export type RoleReceiveVisitContext = {
  role: ComposedRole;
  visitor: Role;
  room: Room;
};

export type RoleChatContext = {
  role: ComposedRole;
  message: string;
  room: Room;
};

export type RoleVotedOutContext = {
  role: ComposedRole;
  votedOut: ComposedRole;
  room: Room;
};

export interface RoleHandlerDefinition {
  priority?: number;
  onAttach?(context: RoleLifecycleContext): void;
  onInit?(context: RoleLifecycleContext): void;
  onDayUpdate?(context: RoleLifecycleContext): void;
  onHandleMessage?(context: RoleChatContext): boolean;
  onDayCommand?(context: RoleCommandContext): boolean;
  onNightCommand?(context: RoleCommandContext): boolean;
  onNightVote?(context: RoleCommandContext): boolean;
  onDayVisit?(context: RoleVisitContext): void;
  onNightVisit?(context: RoleVisitContext): void;
  onVisitOutcomes?(context: RoleVisitOutcomeContext): void;
  onReceiveVisit?(context: RoleReceiveVisitContext): void;
  onNightCleanup?(context: RoleLifecycleContext): void;
  onPlayerVotedOut?(context: RoleVotedOutContext): void;
  onNoDeathDraw?(context: RoleLifecycleContext): void;
}
