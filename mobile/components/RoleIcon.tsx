import React from "react";
import { BadgeHelp, Ban, BrickWall, Cross, Eye, FileSearch, Footprints, Heart, House, LockKeyhole, MessageCircle, PenLine, Radio, Scale, Search, Shield, Star, Target, Handshake, VenetianMask, Swords } from "lucide-react-native";
import { roleIcon, type RoleIconName } from "../../shared/game/roleIcon";

const icons: Record<RoleIconName, typeof Cross> = { medical: Cross, scales: Scale, eye: Eye, search: Search, star: Star, files: FileSearch, radio: Radio, footprints: Footprints, shield: Shield, house: House, heart: Heart, brick: BrickWall, ban: Ban, lock: LockKeyhole, hat: VenetianMask, knife: Swords, target: Target, pen: PenLine, message: MessageCircle, peace: Handshake, unknown: BadgeHelp };
export function RoleIcon({ role, size = 18, color }: { role: string; size?: number; color?: string }) {
  const { icon, faction } = roleIcon(role);
  const Icon = icons[icon];
  return <Icon accessibilityElementsHidden importantForAccessibility="no" size={size} color={color ?? (faction === "town" ? "#5d86fa" : faction === "mafia" ? "#f17e8c" : "#a9b8d7")} />;
}
