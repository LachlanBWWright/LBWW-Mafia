export type DayTime = "Day" | "Night" | string;

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

const roleFactionMap: Record<string, string> = {
  Doctor: "town",
  Judge: "town",
  Watchman: "town",
  Investigator: "town",
  Lawman: "town",
  Vetter: "town",
  Tapper: "town",
  Tracker: "town",
  Bodyguard: "town",
  Nimby: "town",
  Sacrificer: "town",
  Fortifier: "town",
  Roleblocker: "town",
  Jailor: "town",
  Mafia: "mafia",
  "Mafia Roleblocker": "mafia",
  "Mafia Investigator": "mafia",
};

const normalizeTime = (time: DayTime) =>
  time.toLowerCase() === "night" ? "night" : "day";

export const getRoleFaction = (role?: string): string | null => {
  if (!role) {
    return null;
  }
  return roleFactionMap[role] ?? null;
};

export const canPerformVisit = (input: {
  time: DayTime;
  isSelf: boolean;
  targetAlive: boolean;
  actorAlive: boolean;
  actorRole?: string;
  targetRole?: string;
  capability: VisitCapability;
}) => {
  const phase = normalizeTime(input.time);
  if (!input.actorAlive || !input.targetAlive) {
    return false;
  }

  const actorFaction = getRoleFaction(input.actorRole);
  const targetFaction = getRoleFaction(input.targetRole);
  const sameFaction = Boolean(
    actorFaction && targetFaction && actorFaction === targetFaction,
  );

  if (phase === "day") {
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

export const shouldShowVisitAction = (
  time: DayTime,
  capability: VisitCapability,
) => {
  const phase = normalizeTime(time);
  return phase === "day"
    ? capability.dayVisitSelf || capability.dayVisitOthers || capability.dayVisitFaction
    : capability.nightVisitSelf ||
        capability.nightVisitOthers ||
        capability.nightVisitFaction;
};

export const shouldShowDayOnlyActions = (time: DayTime) =>
  normalizeTime(time) === "day";
