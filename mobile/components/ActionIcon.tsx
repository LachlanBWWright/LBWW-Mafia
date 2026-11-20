import React from "react";
import { Ban, CheckCircle2, Footprints, MessageSquare, Search, ShieldPlus, X } from "lucide-react-native";
import type { ActionIconName } from "../../shared/game/actionIcon";

const icons: Record<ActionIconName, typeof Ban> = { visit: Footprints, protect: ShieldPlus, investigate: Search, vote: CheckCircle2, whisper: MessageSquare, cancel: X, abstain: Ban };
export function ActionIcon({ action, size = 16, color = "#e9eeff" }: { action: ActionIconName; size?: number; color?: string }) {
  const Icon = icons[action];
  return <Icon size={size} color={color} accessibilityElementsHidden importantForAccessibility="no" />;
}
