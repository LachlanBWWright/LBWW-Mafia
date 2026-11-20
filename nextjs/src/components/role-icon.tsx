import { BadgeHelp, Ban, BrickWall, Cross, Eye, FileSearch, Footprints, Heart, House, LockKeyhole, MessageCircle, PenLine, Radio, Scale, Search, Shield, Star, Target, Handshake, VenetianMask, Swords } from "lucide-react";
import { roleIcon, type RoleIconName } from "@mernmafia/shared/game/roleIcon";
import { RoleFaction } from "@mernmafia/shared/game/rolesTypes";

const icons: Record<RoleIconName, typeof Cross> = { medical: Cross, scales: Scale, eye: Eye, search: Search, star: Star, files: FileSearch, radio: Radio, footprints: Footprints, shield: Shield, house: House, heart: Heart, brick: BrickWall, ban: Ban, lock: LockKeyhole, hat: VenetianMask, knife: Swords, target: Target, pen: PenLine, message: MessageCircle, peace: Handshake, unknown: BadgeHelp };
export function RoleIcon({ role, size = 18, inheritColor = false }: { role: string; size?: number; inheritColor?: boolean }) {
  const { icon, faction } = roleIcon(role);
  const Icon = icons[icon];
  return <Icon aria-hidden="true" size={size} className={`shrink-0 ${inheritColor ? "" : faction === RoleFaction.Town ? "text-primary" : faction === RoleFaction.Mafia ? "text-destructive" : "text-muted-foreground"}`} />;
}
