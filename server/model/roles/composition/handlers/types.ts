import type { Player } from "../../../player/player.js";
import type { GamePhase } from "../../../rooms/gamePhase.js";
import type { Room } from "../../../rooms/room.js";
import type { GameRole } from "../../roleContracts.js";
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
  visitor: GameRole;
  room: Room;
};

export type RoleChatContext = {
  role: RoleInstance;
  message: string;
  room: Room;
};

export type RoleVotedOutContext = {
  role: RoleInstance;
  votedOut: GameRole;
  room: Room;
};

export type RoleLifecycleCallback = (context: RoleLifecycleContext) => void;
export type RoleChatCallback = (context: RoleChatContext) => HandlerResult;
export type RoleCommandCallback = (context: RoleCommandContext) => CommandResult;
export type RoleVoteCallback = (context: RoleCommandContext) => CommandResult;
export type RoleVisitCallback = (context: RoleVisitContext) => void;
export type RoleVisitOutcomeCallback = (context: RoleVisitOutcomeContext) => void;
export type RoleReceiveVisitCallback = (context: RoleReceiveVisitContext) => void;
export type RoleVotedOutCallback = (context: RoleVotedOutContext) => void;

export type RoleHandlerBuckets = {
  onAttach: RoleLifecycleCallback[];
  onInit: RoleLifecycleCallback[];
  onDayUpdate: RoleLifecycleCallback[];
  onNightCleanup: RoleLifecycleCallback[];
  onNoDeathDraw: RoleLifecycleCallback[];
  onHandleMessage: RoleChatCallback[];
  onDayCommand: RoleCommandCallback[];
  onNightCommand: RoleCommandCallback[];
  onNightVote: RoleVoteCallback[];
  onDayVisit: RoleVisitCallback[];
  onNightVisit: RoleVisitCallback[];
  onVisitOutcomes: RoleVisitOutcomeCallback[];
  onReceiveVisit: RoleReceiveVisitCallback[];
  onPlayerVotedOut: RoleVotedOutCallback[];
};

export type RoleHandlerInput = Partial<{
  [K in keyof RoleHandlerBuckets]: readonly RoleHandlerBuckets[K][number][];
}>;

const EMPTY_HANDLERS: RoleHandlerBuckets = {
  onAttach: [],
  onInit: [],
  onDayUpdate: [],
  onNightCleanup: [],
  onNoDeathDraw: [],
  onHandleMessage: [],
  onDayCommand: [],
  onNightCommand: [],
  onNightVote: [],
  onDayVisit: [],
  onNightVisit: [],
  onVisitOutcomes: [],
  onReceiveVisit: [],
  onPlayerVotedOut: [],
};

export function createRoleHandlers(...parts: readonly RoleHandlerInput[]): RoleHandlerBuckets {
  const handlers: RoleHandlerBuckets = {
    onAttach: [...EMPTY_HANDLERS.onAttach],
    onInit: [...EMPTY_HANDLERS.onInit],
    onDayUpdate: [...EMPTY_HANDLERS.onDayUpdate],
    onNightCleanup: [...EMPTY_HANDLERS.onNightCleanup],
    onNoDeathDraw: [...EMPTY_HANDLERS.onNoDeathDraw],
    onHandleMessage: [...EMPTY_HANDLERS.onHandleMessage],
    onDayCommand: [...EMPTY_HANDLERS.onDayCommand],
    onNightCommand: [...EMPTY_HANDLERS.onNightCommand],
    onNightVote: [...EMPTY_HANDLERS.onNightVote],
    onDayVisit: [...EMPTY_HANDLERS.onDayVisit],
    onNightVisit: [...EMPTY_HANDLERS.onNightVisit],
    onVisitOutcomes: [...EMPTY_HANDLERS.onVisitOutcomes],
    onReceiveVisit: [...EMPTY_HANDLERS.onReceiveVisit],
    onPlayerVotedOut: [...EMPTY_HANDLERS.onPlayerVotedOut],
  };

  for (const part of parts) {
    if (!part) continue;
    handlers.onAttach.push(...(part.onAttach ?? []));
    handlers.onInit.push(...(part.onInit ?? []));
    handlers.onDayUpdate.push(...(part.onDayUpdate ?? []));
    handlers.onNightCleanup.push(...(part.onNightCleanup ?? []));
    handlers.onNoDeathDraw.push(...(part.onNoDeathDraw ?? []));
    handlers.onHandleMessage.push(...(part.onHandleMessage ?? []));
    handlers.onDayCommand.push(...(part.onDayCommand ?? []));
    handlers.onNightCommand.push(...(part.onNightCommand ?? []));
    handlers.onNightVote.push(...(part.onNightVote ?? []));
    handlers.onDayVisit.push(...(part.onDayVisit ?? []));
    handlers.onNightVisit.push(...(part.onNightVisit ?? []));
    handlers.onVisitOutcomes.push(...(part.onVisitOutcomes ?? []));
    handlers.onReceiveVisit.push(...(part.onReceiveVisit ?? []));
    handlers.onPlayerVotedOut.push(...(part.onPlayerVotedOut ?? []));
  }

  return handlers;
}
