import type { ActionIconName } from "../game/actionIcon";
import { gameNames } from "../game/gameNames";
import { nightMatch } from "./matchFixtures";

/** Example names that cover every anonymous portrait; ordinary games use actual game names. */
export const iconExampleNames = gameNames;
const sampleNames: Record<string, string> = { Mira: "Alex", Theo: "Finn", Nadia: "Jade", Sam: "Zoe" };
const rename = (text: string) => text.replace(/Mira|Theo|Nadia|Sam/g, (name) => sampleNames[name]!);
export const iconMatch = {
  ...nightMatch,
  playerName: "Alex",
  action: { ...nightMatch.action, visit: "Finn", feedback: "Night action selected: Finn. You can change it until dawn." },
  players: nightMatch.players.map((player) => ({ ...player, name: sampleNames[player.name] ?? player.name })),
  messages: nightMatch.messages.map((message) => ({ ...message, text: rename(message.text), sender: message.sender ? rename(message.sender) : undefined })),
};
export const actionExamples: { action: ActionIconName; label: string }[] = [
  { action: "visit", label: "Visit" },
  { action: "protect", label: "Protect" },
  { action: "investigate", label: "Investigate" },
  { action: "vote", label: "Vote" },
  { action: "whisper", label: "Whisper" },
  { action: "cancel", label: "Cancel action" },
  { action: "abstain", label: "Abstain" },
];
