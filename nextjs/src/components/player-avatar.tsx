import { avatarInitials, gameAvatarIndex, gamePortraits } from "@mernmafia/shared/game/playerAvatar";
import { Bird, Cat, Moon, SearchCheck, Stethoscope, VenetianMask } from "lucide-react";

const accountPortraits: Record<string, typeof Bird> = { detective: SearchCheck, mafia: VenetianMask, doctor: Stethoscope, moon: Moon, fox: Cat, owl: Bird };
export function PlayerAvatar({ name, preset, anonymous = false }: { name: string; preset?: string | null; anonymous?: boolean }) {
  const Portrait = preset ? accountPortraits[preset] : undefined;
  const character = gamePortraits[gameAvatarIndex(name)]!;
  return <span aria-hidden="true" className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">{anonymous ? <svg width="32" height="32" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill={character.background} /><path d="M7 34 Q8 25 20 25 Q32 25 33 34 Q20 46 7 34 Z" fill={character.clothes} /><rect x={character.head === "oval" ? 13 : 12} y="11" width={character.head === "oval" ? 14 : 16} height="19" rx={character.head === "square" ? 5 : 8} fill={character.skin} />{character.hatPath ? <path d={character.hatPath} fill={character.hat} /> : null}<circle cx="17" cy="21" r="1" fill="#352e35" /><circle cx="23" cy="21" r="1" fill="#352e35" /></svg> : Portrait ? <Portrait size={18} /> : avatarInitials(name)}</span>;
}
