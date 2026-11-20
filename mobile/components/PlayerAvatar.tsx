import React from "react";
import { Text, View } from "react-native";
import { avatarInitials, gameAvatarIndex, gamePortraits } from "../../shared/game/playerAvatar";
import { Bird, Cat, Moon, SearchCheck, Stethoscope, VenetianMask } from "lucide-react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

const accountPortraits: Record<string, typeof Bird> = { detective: SearchCheck, mafia: VenetianMask, doctor: Stethoscope, moon: Moon, fox: Cat, owl: Bird };
export function PlayerAvatar({ name, preset, anonymous = false }: { name: string; preset?: string | null; anonymous?: boolean }) {
  const Portrait = preset ? accountPortraits[preset] : undefined;
  const character = gamePortraits[gameAvatarIndex(name)]!;
  return <View accessible={false} importantForAccessibility="no-hide-descendants" className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">{anonymous ? <Svg width={32} height={32} viewBox="0 0 40 40"><Circle cx={20} cy={20} r={20} fill={character.background} /><Path d="M7 34 Q8 25 20 25 Q32 25 33 34 Q20 46 7 34 Z" fill={character.clothes} /><Rect x={character.head === "oval" ? 13 : 12} y={11} width={character.head === "oval" ? 14 : 16} height={19} rx={character.head === "square" ? 5 : 8} fill={character.skin} />{character.hatPath ? <Path d={character.hatPath} fill={character.hat} /> : null}<Circle cx={17} cy={21} r={1} fill="#352e35" /><Circle cx={23} cy={21} r={1} fill="#352e35" /></Svg> : Portrait ? <Portrait size={18} color="#5d86fa" /> : <Text className="text-sm font-bold text-primary">{avatarInitials(name)}</Text>}</View>;
}
