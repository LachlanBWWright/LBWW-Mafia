import { reconcileCustomRoleForms } from "../lib/customRoleForms";
import { LobbyRulesEditor } from "../components/LobbyRulesEditor";
import { MAX_PLAYERS } from "../../shared/game/gameNames";
import { CustomRoleEditor } from "../components/CustomRoleEditor";
import { GamePackEditor } from "../components/GamePackEditor";
import {
  resolveGameRules,
  summarizeGameSetup,
  getSetupWarnings,
} from "../../shared/game/gameCustomization";
import type { CustomRole } from "../../shared/game/customRoles";
import type { LobbyPreset } from "../../shared/trpc/accountFeatures";
import { LobbyPresets } from "../components/LobbyPresets";
import { lobbyPresetForm } from "../../shared/game/lobbyPresetForm";
import { authenticatedFetch } from "../lib/mobileSession";
import React, { useState } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { StackParamList } from "../App";
import { Button, Input, Screen, SectionHeader } from "../components/ui";
import { useAppState } from "../context/AppStateContext";
import {
  initialRoleForms,
  lobbyRoles,
  parseLobbyForm,
  selectionAlgorithms,
  type LobbyConfig,
  type RoleForm,
} from "../../shared/game/lobbyConfig";

type Props = NativeStackScreenProps<StackParamList, "CreateLobby">;
export function CreateLobbyForm({
  onCreate,
  initialPresets,
}: {
  onCreate: (config: LobbyConfig) => Promise<void>;
  initialPresets?: LobbyPreset[];
}) {
  const [voteVisibility, setVoteVisibility] = useState<"public" | "hidden">(
    "public",
  );
  const [size, setSize] = useState("8");
  const [isPublic, setIsPublic] = useState(false);
  const [lobbyName, setLobbyName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [algorithm, setAlgorithm] = useState<string>("normal");
  const [roles, setRoles] = useState(initialRoleForms);
  const [slots, setSlots] = useState("");
  const [rules, setRules] = useState(() => resolveGameRules({}));
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const sizeInvalid =
    !Number.isInteger(Number(size)) || Number(size) < 2 || Number(size) > MAX_PLAYERS;
  function updateRole(id: string, patch: Partial<RoleForm>) {
    setRoles((current) => ({
      ...current,
      [id]: { ...current[id]!, ...patch },
    }));
  }
  async function create() {
    setNameTouched(true);
    const parsed = parseLobbyForm(size, algorithm, roles, slots, {
      rules,
      customRoles,
      voteVisibility,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid lobby rules.");
      return;
    }
    if (isPublic && !lobbyName.trim()) {
      setError("Enter a lobby name.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onCreate({
        ...parsed.data,
        voteVisibility,
        directory: {
          public: isPublic,
          name: lobbyName.trim() || "Private lobby",
        },
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to create lobby.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  function getConfig() {
    const parsed = parseLobbyForm(size, algorithm, roles, slots, {
      rules,
      customRoles,
      voteVisibility,
    });
    if (!parsed.success)
      throw new Error(
        parsed.error.issues[0]?.message ?? "Invalid lobby rules.",
      );
    return parsed.data;
  }
  function applyConfig(config: LobbyConfig) {
    const form = lobbyPresetForm(config);
    setVoteVisibility(config.voteVisibility ?? "public");
    setSize(form.size);
    setAlgorithm(form.algorithm);
    setRoles(form.roles);
    setSlots(form.slots);
    setRules(resolveGameRules(config));
    setCustomRoles(config.customRoles ?? []);
    setError("");
  }
  function updateCustomRoles(next: CustomRole[]) {
    setCustomRoles(next);
    setRoles((current) => reconcileCustomRoleForms(current, next));
  }
  const preview = parseLobbyForm(size, algorithm, roles, slots, {
    rules,
    customRoles,
    voteVisibility,
  });
  return (
    <View className="gap-5">
      <SectionHeader title="Lobby rules" />
      <View className="gap-2">
        <Text className="text-sm font-bold text-foreground">Players</Text>
        <Input
          accessibilityLabel="Players"
          value={size}
          onChangeText={setSize}
          keyboardType="number-pad"
        />
        {sizeInvalid ? (
          <Text className="text-sm text-destructive">
            Choose between 2 and {MAX_PLAYERS} players.
          </Text>
        ) : null}
      </View>
      <Button
        variant="outline"
        accessibilityState={{ checked: isPublic }}
        onPress={() => setIsPublic(!isPublic)}
      >
        {isPublic ? "List publicly: on" : "List publicly: off"}
      </Button>
      {isPublic ? (
        <View className="gap-2">
          <Input
            accessibilityLabel="Lobby name"
            placeholder="Lobby name"
            onBlur={() => setNameTouched(true)}
            maxLength={60}
            value={lobbyName}
            onChangeText={setLobbyName}
          />
          {nameTouched && !lobbyName.trim() ? (
            <Text className="text-sm text-destructive">
              Enter a lobby name.
            </Text>
          ) : null}
        </View>
      ) : null}
      <View className="gap-2">
        <Text className="text-sm font-bold text-foreground">Votes</Text>
        <View className="flex-row gap-2">
          {(["public", "hidden"] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={voteVisibility === value ? "primary" : "outline"}
              onPress={() => setVoteVisibility(value)}
            >
              {value === "public" ? "Public votes" : "Hidden votes"}
            </Button>
          ))}
        </View>
      </View>
      {preview.success ? (
        <View className="gap-2">
          <SectionHeader title="Setup summary" />
          {summarizeGameSetup(preview.data).map((line) => (
            <Text key={line} className="text-foreground">
              {line}
            </Text>
          ))}
          {getSetupWarnings(preview.data).map((line) => (
            <Text key={line} className="text-amber-600">
              {line}
            </Text>
          ))}
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-destructive">
          {error}
        </Text>
      ) : null}
      <Button onPress={() => void create()} disabled={submitting}>
        {submitting ? "Creating…" : "Create lobby"}
      </Button>
      <Button
        variant="ghost"
        accessibilityState={{ expanded: advanced }}
        onPress={() => setAdvanced(!advanced)}
      >
        Advanced setup{advanced ? " −" : " +"}
      </Button>
      {advanced ? (
        <View className="gap-4">
      <View className="gap-2">
        <Text className="text-sm font-bold text-foreground">
          Role selection
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {selectionAlgorithms.map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={algorithm === value ? "primary" : "outline"}
              accessibilityState={{ selected: algorithm === value }}
              onPress={() => setAlgorithm(value)}
            >
              {label}
            </Button>
          ))}
        </View>
      </View>

      {algorithm === "explicit-slots" ? (
        <View className="gap-2">
          <Text className="text-sm font-bold text-foreground">Role slots</Text>
          <Input
            accessibilityLabel="Role slots"
            value={slots}
            onChangeText={setSlots}
            placeholder="doctor, mafia, investigator"
          />
          <Text className="text-sm text-muted-foreground">
            Use role IDs separated by commas; the count must equal the player
            count.
          </Text>
        </View>
      ) : algorithm !== "normal" ? (
        <>
          <SectionHeader title="Role pool" />
          {[
            ...lobbyRoles,
            ...customRoles.map(
              (role) => [`custom:${role.id}`, role.name] as const,
            ),
          ].map(([id, label]) => {
            const role = roles[id]!;
            return (
              <View key={id} className="gap-2 border-b border-border pb-3">
                <Button
                  variant={role.enabled ? "primary" : "outline"}
                  onPress={() => updateRole(id, { enabled: !role.enabled })}
                >{`${role.enabled ? "✓ " : ""}${label}`}</Button>
                {role.enabled ? (
                  <View className="flex-row flex-wrap gap-2">
                    {(
                      [
                        ["weight", "Weight"],
                        ["minimum", "Min"],
                        ["maximum", "Max"],
                        ["tier", "Tier"],
                      ] as const
                    ).map(([field, fieldLabel]) => (
                      <View key={field} className="min-w-16 flex-1 gap-1">
                        <Text className="text-xs text-muted-foreground">
                          {fieldLabel}
                        </Text>
                        <Input
                          accessibilityLabel={`${label} ${field}`}
                          keyboardType="numeric"
                          value={role[field]}
                          placeholder={
                            field === "maximum" || field === "tier" ? "—" : "0"
                          }
                          onChangeText={(value) =>
                            updateRole(id, { [field]: value })
                          }
                        />
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </>
      ) : null}

          <LobbyPresets
            initialPresets={initialPresets}
            getConfig={getConfig}
            onApply={applyConfig}
          />
          <GamePackEditor getConfig={getConfig} onApply={applyConfig} />
          <CustomRoleEditor roles={customRoles} onChange={updateCustomRoles} />
          <LobbyRulesEditor rules={rules} onChange={setRules} />
        </View>
      ) : null}

    </View>
  );
}
export function CreateLobbyScreen({ navigation }: Props) {
  const { authToken } = useAppState();
  async function create(config: LobbyConfig) {
    if (!authToken) {
      navigation.navigate("SignIn");
      return;
    }
    const base =
      process.env.EXPO_PUBLIC_TRPC_URL?.replace(/\/api\/trpc$/, "") ??
      "http://localhost:3000";
    const response = await authenticatedFetch(`${base}/api/lobbies`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(config),
    });
    const result = (await response.json()) as {
      roomId?: string;
      error?: string;
    };
    if (!response.ok || !result.roomId)
      throw new Error(result.error ?? "Unable to create lobby.");
    navigation.replace("Lobby", { roomId: result.roomId });
  }
  return (
    <Screen
      navigation={navigation}
      activeRoute="CreateLobby"
      title="Create lobby"
    >
      {authToken ? (
        <CreateLobbyForm onCreate={create} />
      ) : (
        <Button onPress={() => navigation.navigate("SignIn")}>
          Sign in to create a lobby
        </Button>
      )}
    </Screen>
  );
}
