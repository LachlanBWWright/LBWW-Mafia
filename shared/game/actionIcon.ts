export type ActionIconName = "visit" | "protect" | "investigate" | "vote" | "whisper" | "cancel" | "abstain";

export function visitActionIcon(role: string | undefined, time: "Day" | "Night"): ActionIconName {
  if (time === "Night" && role === "Doctor") return "protect";
  if (time === "Night" && role === "Investigator") return "investigate";
  return "visit";
}
