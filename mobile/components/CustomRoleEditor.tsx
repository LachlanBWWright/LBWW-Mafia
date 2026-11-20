import React, { useState } from "react";
import { Text, View } from "react-native";
import { createCustomRoleDraft, customRoleEffects, customRoleSchema, describeCustomRole, type CustomRole } from "../../shared/game/customRoles";
import { Button, Input, SectionHeader } from "./ui";
export function CustomRoleEditor({ roles, onChange }: { roles: CustomRole[]; onChange: (roles: CustomRole[]) => void }) {
  const [draft, setDraft] = useState(createCustomRoleDraft);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  function reset() { setDraft(createCustomRoleDraft()); setEditingId(null); setError(""); }
  function save() {
    const result = customRoleSchema.safeParse(draft);
    if (!result.success) { setError(result.error.issues[0]?.message ?? "Invalid custom role."); return; }
    if (roles.some((role) => role.id === result.data.id && role.id !== editingId)) { setError("Choose a unique role ID."); return; }
    onChange(editingId ? roles.map((role) => role.id === editingId ? result.data : role) : [...roles, result.data]); reset();
  }
  return <View className="gap-3">
    <SectionHeader title="Custom roles" />
    {roles.map((role) => <View key={role.id} className="gap-2 border-b border-border pb-3"><Text className="text-foreground">{describeCustomRole(role)}</Text><Button variant="outline" accessibilityLabel={`Edit ${role.name}`} onPress={() => { setDraft({ ...role }); setEditingId(role.id); setError(""); }}>Edit</Button><Button variant="ghost" accessibilityLabel={`Remove ${role.name}`} onPress={() => onChange(roles.filter((item) => item.id !== role.id))}>Remove</Button></View>)}
    {([ ["id", "Role ID"], ["name", "Role name"], ["description", "Role description"] ] as const).map(([field, label]) => <View key={field} className="gap-1"><Text className="text-foreground">{label}</Text><Input accessibilityLabel={label} value={draft[field]} editable={field !== "id" || editingId === null} onChangeText={(value) => setDraft({ ...draft, [field]: value })} /></View>)}
    <Text className="text-foreground">Alignment</Text><View className="flex-row gap-2">{(["town", "mafia"] as const).map((alignment) => <Button key={alignment} size="sm" variant={draft.alignment === alignment ? "primary" : "outline"} onPress={() => setDraft({ ...draft, alignment })}>{alignment}</Button>)}</View>
    <Text className="text-foreground">Night ability</Text><View className="flex-row flex-wrap gap-2">{customRoleEffects.map((effect) => <Button key={effect} size="sm" variant={draft.effect === effect ? "primary" : "outline"} onPress={() => setDraft({ ...draft, effect, investigationAccuracy: 100, target: effect === "redirect" ? "other" : draft.target })}>{effect}</Button>)}</View>
    <Text className="text-foreground">Target</Text><View className="flex-row gap-2">{(["other", "any"] as const).map((target) => <Button key={target} size="sm" disabled={draft.effect === "redirect" && target === "any"} variant={draft.target === target ? "primary" : "outline"} onPress={() => setDraft({ ...draft, target })}>{target === "any" ? "Allow self-targeting" : "Others only"}</Button>)}</View>
    <Text className="text-foreground">Charges (blank for unlimited)</Text><Input accessibilityLabel="Ability charges" keyboardType="number-pad" value={draft.charges === undefined ? "" : String(draft.charges)} onChangeText={(value) => setDraft({ ...draft, charges: value === "" ? undefined : Number(value) })} />
    <Text className="text-foreground">Cooldown nights</Text><Input accessibilityLabel="Cooldown nights" keyboardType="number-pad" value={String(draft.cooldownNights)} onChangeText={(value) => setDraft({ ...draft, cooldownNights: Number(value) })} />
    <Button variant={draft.noRepeatTarget ? "primary" : "outline"} onPress={() => setDraft({ ...draft, noRepeatTarget: !draft.noRepeatTarget })}>{draft.noRepeatTarget ? "✓ " : ""}No consecutive target</Button>
    {draft.effect === "investigate" ? <><Text className="text-foreground">Investigation accuracy (%)</Text><Input accessibilityLabel="Investigation accuracy" keyboardType="number-pad" value={String(draft.investigationAccuracy)} onChangeText={(value) => setDraft({ ...draft, investigationAccuracy: Number(value) })} /></> : null}
    <Text className="text-sm text-muted-foreground">Wins with its faction.</Text>
    {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
    <Button variant="outline" onPress={save}>{editingId ? "Save role changes" : "Add custom role"}</Button>
    {editingId ? <Button variant="ghost" onPress={reset}>Cancel role changes</Button> : null}
  </View>;
}
