import { roleFactionsByName } from "./rolesList";

/** Enum representing the two game phases as seen by clients (capitalized, used in wire protocol). */
export enum DayTime {
  Day = "Day",
  Night = "Night",
}

export type VisitCapability = {
  dayVisitSelf: boolean;
  dayVisitOthers: boolean;
  dayVisitFaction: boolean;
  nightVisitSelf: boolean;
  nightVisitOthers: boolean;
  nightVisitFaction: boolean;
};

export const defaultVisitCapability: VisitCapability = {
  dayVisitSelf: false,
  dayVisitOthers: false,
  dayVisitFaction: false,
  nightVisitSelf: false,
  nightVisitOthers: false,
  nightVisitFaction: false,
};

/**
 * Determines the faction affiliation of a role from the provided role name.
 *
 * @param role - The name of the role to look up
 * @returns The faction string ("town" or "mafia") or null if not found
 */
export const getRoleFaction = (role?: string): string | null => {
  if (!role) {
    return null;
  }
  return roleFactionsByName.get(role) ?? null;
};

/**
 * Determines if a player can perform a visit action based on game state, role capabilities, and time of day.
 * Considers whether the visit is self-targeting, faction-based, or cross-faction.
 *
 * @param input - Input parameters
 * @param input .time - Current phase (Day or Night)
 * @param input .isSelf - Whether the target is the actor
 * @param input .targetAlive - Whether the target player is alive
 * @param input .actorAlive - Whether the actor is alive
 * @param input .actorRole - The actor's role name
 * @param input .targetRole - The target's role name
 * @param input .capability - The actor's visit capabilities
 * @returns True if the visit is allowed, false otherwise
 */
export const canPerformVisit = (input: {
  time: DayTime;
  isSelf: boolean;
  targetAlive: boolean;
  actorAlive: boolean;
  actorRole?: string;
  targetRole?: string;
  capability: VisitCapability;
}) => {
  if (!input.actorAlive || !input.targetAlive) {
    return false;
  }

  const actorFaction = getRoleFaction(input.actorRole);
  const targetFaction = getRoleFaction(input.targetRole);
  const sameFaction = Boolean(
    actorFaction && targetFaction && actorFaction === targetFaction,
  );

  if (input.time === DayTime.Day) {
    if (input.isSelf) {
      return input.capability.dayVisitSelf;
    }
    if (sameFaction) {
      return input.capability.dayVisitFaction;
    }
    return input.capability.dayVisitOthers;
  }

  if (input.isSelf) {
    return input.capability.nightVisitSelf;
  }
  if (sameFaction) {
    return input.capability.nightVisitFaction;
  }
  return input.capability.nightVisitOthers;
};

/**
 * Determines if the UI should display visit action options based on time of day and capabilities.
 * Returns true if the player has any visit capability for the current phase.
 *
 * @param time - Current phase (Day or Night)
 * @param capability - The player's visit capabilities
 * @returns True if any visit action should be displayed
 */
export const shouldShowVisitAction = (
  time: DayTime,
  capability: VisitCapability,
) =>
  time === DayTime.Day
    ? capability.dayVisitSelf ||
      capability.dayVisitOthers ||
      capability.dayVisitFaction
    : capability.nightVisitSelf ||
      capability.nightVisitOthers ||
      capability.nightVisitFaction;

/**
 * Determines if the current phase is a daytime phase.
 * Used to conditionally show or hide day-only actions.
 *
 * @param time - Current phase
 * @returns True if the phase is Day
 */
export const shouldShowDayOnlyActions = (time: DayTime) => time === DayTime.Day;

/**
 * Determines if a player can vote for the elimination of a target.
 * Voting is only allowed during the day phase when both players are alive and distinct.
 *
 * @param input - Input parameters
 * @param input .time - Current phase (Day or Night)
 * @param input .actorAlive - Whether the voter is alive
 * @param input .targetAlive - Whether the target is alive
 * @param input .isSelf - Whether the target is the voter
 * @param input .canVote - Whether the role can vote at all
 * @returns True if the vote is allowed, false otherwise
 */
export const canVoteTarget = (input: {
  time: DayTime;
  actorAlive: boolean;
  targetAlive: boolean;
  isSelf: boolean;
  canVote: boolean;
}) => {
  if (!shouldShowDayOnlyActions(input.time)) {
    return false;
  }
  return (
    input.actorAlive && input.targetAlive && !input.isSelf && input.canVote
  );
};

/**
 * Determines if a player can send a whisper message to a target.
 * Whispering is only allowed during the day phase when the target is alive and distinct from the actor.
 *
 * @param input - Input parameters
 * @param input .time - Current phase (Day or Night)
 * @param input .targetAlive - Whether the target is alive
 * @param input .isSelf - Whether the target is the whisper sender
 * @param input .hasMessage - Whether the whisper message is non-empty
 * @returns True if the whisper is allowed, false otherwise
 */
export const canWhisperTarget = (input: {
  time: DayTime;
  targetAlive: boolean;
  isSelf: boolean;
  hasMessage: boolean;
}) => {
  if (!shouldShowDayOnlyActions(input.time)) {
    return false;
  }
  return input.targetAlive && !input.isSelf && input.hasMessage;
};
