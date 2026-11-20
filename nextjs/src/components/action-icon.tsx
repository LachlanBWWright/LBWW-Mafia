import { Ban, CheckCircle2, Footprints, MessageSquare, Search, ShieldPlus, X } from "lucide-react";
import type { ActionIconName } from "@mernmafia/shared/game/actionIcon";

const icons: Record<ActionIconName, typeof Ban> = { visit: Footprints, protect: ShieldPlus, investigate: Search, vote: CheckCircle2, whisper: MessageSquare, cancel: X, abstain: Ban };
export function ActionIcon({ action, size = 16 }: { action: ActionIconName; size?: number }) {
  const Icon = icons[action];
  return <Icon size={size} aria-hidden="true" className="shrink-0" />;
}
