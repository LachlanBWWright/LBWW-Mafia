import { allRoles } from "./rolesList";

export type RoleIconName = "medical" | "scales" | "eye" | "search" | "star" | "files" | "radio" | "footprints" | "shield" | "house" | "heart" | "brick" | "ban" | "lock" | "hat" | "knife" | "target" | "pen" | "message" | "peace" | "unknown";

const icons: Record<string, RoleIconName> = {
  Doctor: "medical", Judge: "scales", Watchman: "eye", Investigator: "search",
  Lawman: "star", Vetter: "files", Tapper: "radio", Tracker: "footprints",
  Bodyguard: "shield", Nimby: "house", Sacrificer: "heart", Fortifier: "brick",
  Roleblocker: "ban", Jailor: "lock", Mafia: "hat", "Mafia Roleblocker": "ban",
  "Mafia Investigator": "search", Maniac: "knife", Sniper: "target", Framer: "pen",
  Confesser: "message", Peacemaker: "peace",
};

/** Presentation only. Call with a role already visible to the viewer. */
export function roleIcon(role: string) {
  const known = allRoles.find((entry) => entry.name.toLowerCase() === role.toLowerCase());
  return { icon: known ? icons[known.name] ?? "unknown" : "unknown", faction: known?.faction } as const;
}
