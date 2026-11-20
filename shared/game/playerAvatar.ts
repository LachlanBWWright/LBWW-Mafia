import { gameNames } from "./gameNames";

/** Display-only fallback based on the name already visible in the lobby. */
export function avatarInitials(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return "?";
  return Array.from(words[0]!)[0]!.toLocaleUpperCase();
}

export type GamePortrait = { background: string; skin: string; clothes: string; hat: string; head: "round" | "oval" | "square"; hatPath?: string };

const beanie = "M11 15 Q11 5 20 5 Q29 5 29 15 Z M10 15 H30 V18 H10 Z";
const brim = "M13 14 L15 6 H25 L27 14 Z M8 14 H32 V17 H8 Z";
const hair = "M11 16 Q10 5 20 6 Q30 5 29 16 L26 13 Q21 15 16 11 L13 16 Z";
const cap = "M11 14 Q12 6 21 7 Q28 7 29 14 Z M11 14 H33 Q34 16 31 17 H11 Z";
const roundHat = "M12 14 Q12 5 20 5 Q28 5 28 14 Z M9 14 H31 V17 H9 Z";

/** Twelve deliberately simple character variants; colors and shapes carry no game information. */
export const gamePortraits: readonly GamePortrait[] = [
  { background: "#d9e7ec", skin: "#a9664c", clothes: "#426d78", hat: "#29444c", head: "round" },
  { background: "#ecdcd5", skin: "#e4a983", clothes: "#854e61", hat: "#593a62", head: "oval", hatPath: beanie },
  { background: "#e5e3c9", skin: "#82513f", clothes: "#68805d", hat: "#344e49", head: "square", hatPath: brim },
  { background: "#d8ddf2", skin: "#dba27f", clothes: "#60649a", hat: "#4b3438", head: "round", hatPath: hair },
  { background: "#e8d9dc", skin: "#8a583f", clothes: "#a75f50", hat: "#526887", head: "oval", hatPath: cap },
  { background: "#d6e9df", skin: "#e1ad8e", clothes: "#40846c", hat: "#c08343", head: "square", hatPath: roundHat },
  { background: "#e5dbef", skin: "#744a40", clothes: "#80619b", hat: "#3f3d56", head: "oval" },
  { background: "#f0e5cb", skin: "#ce9070", clothes: "#ad724b", hat: "#466d71", head: "square", hatPath: beanie },
  { background: "#d4e2ec", skin: "#d6a17a", clothes: "#476b95", hat: "#544c6f", head: "round", hatPath: brim },
  { background: "#ecd7c8", skin: "#865742", clothes: "#aa6a5c", hat: "#382b31", head: "oval", hatPath: hair },
  { background: "#dce9cf", skin: "#edb390", clothes: "#6a8657", hat: "#985a58", head: "square", hatPath: cap },
  { background: "#e6def0", skin: "#a36e56", clothes: "#78699d", hat: "#526d83", head: "round", hatPath: roundHat },
  { background: "#f1dcc6", skin: "#754637", clothes: "#ad6945", hat: "#58785a", head: "square", hatPath: cap },
  { background: "#cee4df", skin: "#ecb995", clothes: "#4c817c", hat: "#664a43", head: "round", hatPath: hair },
  { background: "#e9d5e0", skin: "#bb805f", clothes: "#945d79", hat: "#5b4c75", head: "oval", hatPath: brim },
  { background: "#d6e2c8", skin: "#80513c", clothes: "#668658", hat: "#a25f46", head: "square", hatPath: beanie },
  { background: "#f1e0d5", skin: "#dca27b", clothes: "#98745a", hat: "#3f5c73", head: "oval" },
  { background: "#cddff0", skin: "#9a654e", clothes: "#4c719c", hat: "#9d6d45", head: "square", hatPath: roundHat },
  { background: "#e7e3c9", skin: "#e6ad88", clothes: "#898b54", hat: "#865463", head: "round", hatPath: cap },
  { background: "#e5d7d6", skin: "#714735", clothes: "#965b5d", hat: "#383237", head: "oval", hatPath: hair },
];

/** Derive a repeatable game portrait from the public game name alone. */
export function gameAvatarIndex(name: string): number {
  const index = gameNames.findIndex((entry) => entry.toLowerCase() === name.trim().toLowerCase());
  if (index >= 0) return index;
  let hash = 2166136261;
  for (const character of name.normalize("NFKC")) {
    hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619);
  }
  return (hash >>> 0) % gamePortraits.length;
}
