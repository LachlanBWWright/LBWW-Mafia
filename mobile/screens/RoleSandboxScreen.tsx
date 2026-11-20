import React, { useState } from "react";
import { Switch, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { StackParamList } from "../App";
import {
  createCustomRoleDraft,
  type CustomRole,
} from "../../shared/game/customRoles";
import { requestRoleSandbox } from "../../shared/game/roleSandboxClient";
import type { RoleSandboxResult } from "../../shared/game/roleSandbox";
import { Button, Input, Screen } from "../components/ui";
import { CustomRoleEditor } from "../components/CustomRoleEditor";
const endpoint = `${process.env.EXPO_PUBLIC_TRPC_URL?.replace(/\/api\/trpc\/?$/, "") ?? "http://localhost:3000"}/api/sandbox`;
export function RoleSandboxContent({
  run = requestRoleSandbox,
}: {
  run?: typeof requestRoleSandbox;
}) {
  const [roles, setRoles] = useState<CustomRole[]>(() => [
    createCustomRoleDraft(),
  ]);
  const [selected, setSelected] = useState("field-medic");
  const [nights, setNights] = useState("3");
  const [targetAlignment, setAlignment] = useState<"town" | "mafia">("mafia");
  const [incomingAttack, setAttack] = useState(true);
  const [result, setResult] = useState<RoleSandboxResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function simulate() {
    const role = roles.find((item) => item.id === selected);
    if (!role) {
      setError("Choose a role to test.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(
        await run(
          { role, nights: Number(nights), targetAlignment, incomingAttack },
          endpoint,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to run sandbox.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View className="gap-5">
      <Text className="text-muted-foreground">
        Repeat a night action against the same target to inspect charges,
        cooldowns and targeting restrictions. Another player attacks the target
        when incoming attack is enabled. Investigation samples are fixed at
        zero.
      </Text>
      {busy ? null : <CustomRoleEditor roles={roles} onChange={setRoles} />}
      <Text className="text-foreground">Role to test</Text>
      <View className="flex-row flex-wrap gap-2">
        {roles.map((role) => (
          <Button
            key={role.id}
            disabled={busy}
            variant={selected === role.id ? "primary" : "outline"}
            onPress={() => setSelected(role.id)}
          >
            {role.name}
          </Button>
        ))}
      </View>
      <Text className="text-foreground">Nights (1–5)</Text>
      <Input
        accessibilityLabel="Nights"
        value={nights}
        onChangeText={setNights}
        keyboardType="number-pad"
        editable={!busy}
      />
      <Text className="text-foreground">Target alignment</Text>
      <View className="flex-row gap-2">
        {(["town", "mafia"] as const).map((alignment) => (
          <Button
            key={alignment}
            disabled={busy}
            variant={targetAlignment === alignment ? "primary" : "outline"}
            onPress={() => setAlignment(alignment)}
          >
            {alignment}
          </Button>
        ))}
      </View>
      <View className="flex-row items-center gap-2">
        <Text className="text-foreground">Incoming attack</Text>
        <Switch
          accessibilityLabel="Incoming attack"
          value={incomingAttack}
          onValueChange={setAttack}
          disabled={busy}
        />
      </View>
      <Button
        onPress={() => void simulate()}
        disabled={busy || !roles.some((role) => role.id === selected)}
      >
        {busy ? "Running…" : "Run scenario"}
      </Button>
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive">
          {error}
        </Text>
      ) : null}
      {result ? (
        <View className="gap-3">
          <Text accessibilityRole="header" className="text-xl text-foreground">
            Scenario results
          </Text>
          {result.nights.map((night) => (
            <View
              key={night.night}
              className="gap-1 border-b border-border pb-3"
            >
              <Text className="font-semibold text-foreground">
                Night {night.night}:{" "}
                {night.accepted ? "Action accepted" : "Action rejected"}
              </Text>
              <Text className="text-foreground">
                Target damage: {night.targetDamage} · Defence:{" "}
                {night.targetDefence} · Blocked:{" "}
                {night.targetBlocked ? "yes" : "no"} · Redirected to actor:{" "}
                {night.redirectedToActor ? "yes" : "no"}
              </Text>
              {night.notices.map((notice, index) => (
                <Text key={index} className="text-foreground">
                  {notice}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
export function RoleSandboxScreen({
  navigation,
}: NativeStackScreenProps<StackParamList, "Sandbox">) {
  return (
    <Screen navigation={navigation} activeRoute="Sandbox" title="Role sandbox">
      <RoleSandboxContent />
    </Screen>
  );
}
