import React from "react";
import { Text, View } from "react-native";
import type { ResolvedGameRules } from "../../shared/game/gameRules";
import { Button, Input, SectionHeader } from "./ui";

type Rules = ResolvedGameRules;
type Props = { rules: Rules; onChange: (rules: Rules) => void };
function Choice<T extends string>({ label, value, values, onChange }: { label: string; value: T; values: readonly T[]; onChange: (value: T) => void }) {
  return <View className="gap-2"><Text className="font-bold text-foreground">{label}</Text><View className="flex-row flex-wrap gap-2">{values.map((option) => <Button key={option} size="sm" variant={value === option ? "primary" : "outline"} accessibilityLabel={`${label}: ${option}`} accessibilityState={{ selected: value === option }} onPress={() => onChange(option)}>{option}</Button>)}</View></View>;
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <Button variant={value ? "primary" : "outline"} accessibilityLabel={label} accessibilityState={{ checked: value }} onPress={() => onChange(!value)}>{value ? "✓ " : ""}{label}</Button>;
}
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <View className="gap-1"><Text className="text-foreground">{label}</Text><Input accessibilityLabel={label} keyboardType="number-pad" value={String(value)} onChangeText={(text) => onChange(Number(text))} /></View>;
}
export function LobbyRulesEditor({ rules, onChange }: Props) {
  return <View className="gap-5">
    <SectionHeader title="Match pace" />
    <NumberField label="Day duration (seconds)" value={rules.timing.daySeconds} onChange={(daySeconds) => onChange({ ...rules, timing: { ...rules.timing, daySeconds } })} />
    <NumberField label="Night duration (seconds)" value={rules.timing.nightSeconds} onChange={(nightSeconds) => onChange({ ...rules, timing: { ...rules.timing, nightSeconds } })} />
    <NumberField label="First day duration (seconds)" value={rules.timing.firstDaySeconds} onChange={(firstDaySeconds) => onChange({ ...rules, timing: { ...rules.timing, firstDaySeconds } })} />
    <Toggle label="Finish phases when everyone submits" value={rules.timing.earlyEnd} onChange={(earlyEnd) => onChange({ ...rules, timing: { ...rules.timing, earlyEnd } })} />
    <SectionHeader title="Voting and information" />
    <Choice label="Vote method" value={rules.voting.method} values={["majority", "plurality"]} onChange={(method) => onChange({ ...rules, voting: { ...rules.voting, method } })} />
    <Choice label="Tied votes" value={rules.voting.tie} values={["none", "random"]} onChange={(tie) => onChange({ ...rules, voting: { ...rules.voting, tie } })} />
    <Toggle label="Allow changing votes" value={rules.voting.allowRevote} onChange={(allowRevote) => onChange({ ...rules, voting: { ...rules.voting, allowRevote } })} />
    <Choice label="Reveal on death" value={rules.reveal.onDeath} values={["role", "faction", "none"]} onChange={(onDeath) => onChange({ ...rules, reveal: { ...rules.reveal, onDeath } })} />
    <Toggle label="Show possible roles" value={rules.reveal.rolePool} onChange={(rolePool) => onChange({ ...rules, reveal: { ...rules.reveal, rolePool } })} />
    <SectionHeader title="Communication" />
    <NumberField label="Messages per phase" value={rules.communication.messageLimit} onChange={(messageLimit) => onChange({ ...rules, communication: { ...rules.communication, messageLimit } })} />
    {([ ["whispers", "Allow whispers"], ["lastWords", "Allow last words"], ["observerChat", "Allow spectator chat"] ] as const).map(([field, label]) => <Toggle key={field} label={label} value={rules.communication[field]} onChange={(value) => onChange({ ...rules, communication: { ...rules.communication, [field]: value } })} />)}
    <SectionHeader title="Bots" />
    <Toggle label="Fill empty seats with bots" value={rules.bots.fillEmptySeats} onChange={(fillEmptySeats) => onChange({ ...rules, bots: { ...rules.bots, fillEmptySeats } })} />
    <Choice label="Bot difficulty" value={rules.bots.difficulty} values={["casual", "standard", "challenging"]} onChange={(difficulty) => onChange({ ...rules, bots: { ...rules.bots, difficulty } })} />
    <Choice label="Bot personality" value={rules.bots.personality} values={["cautious", "argumentative", "deceptive"]} onChange={(personality) => onChange({ ...rules, bots: { ...rules.bots, personality } })} />
    <SectionHeader title="Presentation" />
    <Choice label="Room theme" value={rules.presentation.theme} values={["classic", "noir", "midnight"]} onChange={(theme) => onChange({ ...rules, presentation: { ...rules.presentation, theme } })} />
    <Choice label="Announcements" value={rules.presentation.announcementStyle} values={["classic", "concise"]} onChange={(announcementStyle) => onChange({ ...rules, presentation: { ...rules.presentation, announcementStyle } })} />
  </View>;
}
