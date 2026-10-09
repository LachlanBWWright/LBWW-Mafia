import { authIdentity } from "../lib/authIdentity";
import { getAuthToken } from "../lib/authToken";
import React, { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  avatarPresets,
  avatarOptions,
  type FeaturePreferences,
} from "../../shared/trpc/accountFeatures";
import { trpcClient } from "../lib/trpc";
import { Button, Input, SectionHeader } from "./ui";
const emoji: Record<string, string> = Object.fromEntries(
  avatarOptions.map((option) => [option.id, option.symbol]),
);
export function AccountPreferences({
  initialPreferences,
  initialBlocked = [],
  onDeleted,
}: {
  initialPreferences?: FeaturePreferences;
  initialBlocked?: { id: string; name: string | null; handle: string | null }[];
  onDeleted: () => void;
}) {
  const [preferences, setPreferences] = useState(initialPreferences),
    [blocked, setBlocked] = useState(initialBlocked);
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    if (initialPreferences) return;
    let active = true;
    void Promise.all([
      trpcClient.features.preferences.query(),
      trpcClient.features.blocked.query(),
    ])
      .then(([p, b]) => {
        if (active) {
          setPreferences(p);
          setBlocked(b);
        }
      })
      .catch(() => {
        if (active) setStatus("Unable to load account preferences.");
      });
    return () => {
      active = false;
    };
  }, [initialPreferences]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      await action();
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to complete this action.",
      );
    } finally {
      setBusy(false);
    }
  }
  function update<K extends keyof FeaturePreferences>(
    key: K,
    value: FeaturePreferences[K],
  ) {
    setPreferences((p) => (p ? { ...p, [key]: value } : p));
  }
  if (!preferences)
    return (
      <Text accessibilityRole="alert" className="text-foreground">
        {status || "Loading privacy preferences…"}
      </Text>
    );
  return (
    <View className="gap-5 border-t border-border pt-5">
      <View className="gap-3">
        <SectionHeader title="Avatar" />
        <View className="flex-row flex-wrap gap-2">
          <Button
            disabled={busy}
            variant={preferences.avatarPreset === null ? "primary" : "outline"}
            onPress={() => update("avatarPreset", null)}
          >
            Google photo
          </Button>
          {avatarPresets.map((id) => (
            <Button
              key={id}
              disabled={busy}
              variant={preferences.avatarPreset === id ? "primary" : "outline"}
              onPress={() => update("avatarPreset", id)}
            >{`${emoji[id]} ${id[0]!.toUpperCase() + id.slice(1)}`}</Button>
          ))}
        </View>
      </View>
      <View className="gap-3">
        <SectionHeader title="Privacy" />
        {(["messagePermission", "invitePermission"] as const).map((key) => (
          <View key={key} className="gap-2">
            <Text className="text-foreground">
              {key === "messagePermission"
                ? "Who can message you"
                : "Who can invite you"}
            </Text>
            <View className="flex-row gap-2">
              {(["friends", "nobody"] as const).map((value) => (
                <Button
                  key={value}
                  disabled={busy}
                  variant={preferences[key] === value ? "primary" : "outline"}
                  onPress={() => update(key, value)}
                >
                  {value === "friends" ? "Friends" : "Nobody"}
                </Button>
              ))}
            </View>
          </View>
        ))}
        <View className="flex-row items-center justify-between">
          <Text className="text-foreground">Hide online status</Text>
          <Switch
            accessibilityLabel="Hide online status"
            value={preferences.hidePresence}
            disabled={busy}
            onValueChange={(value) => update("hidePresence", value)}
          />
        </View>
      </View>
      <View className="gap-3">
        <SectionHeader title="In-app notifications" />
        {(
          [
            ["notificationFriendRequests", "Friend requests"],
            ["notificationMessages", "Messages"],
            ["notificationInvites", "Lobby invitations"],
          ] as const
        ).map(([key, label]) => (
          <View key={key} className="flex-row items-center justify-between">
            <Text className="text-foreground">{label}</Text>
            <Switch
              accessibilityLabel={label}
              value={preferences[key]}
              disabled={busy}
              onValueChange={(value) => update(key, value)}
            />
          </View>
        ))}
        <Button
          disabled={busy}
          onPress={() =>
            void run(async () => {
              setPreferences(
                await trpcClient.features.updatePreferences.mutate(preferences),
              );
              setStatus("Preferences saved.");
            })
          }
        >
          Save privacy preferences
        </Button>
      </View>
      <View className="gap-3">
        <SectionHeader title="Blocked accounts" />
        {blocked.length ? (
          blocked.map((user) => (
            <View key={user.id} className="gap-2 border-b border-border pb-3">
              <Text className="text-foreground">
                {user.handle ?? user.name ?? "Player"}
              </Text>
              <Button
                variant="outline"
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    await trpcClient.features.unblock.mutate({
                      userId: user.id,
                    });
                    setBlocked((rows) =>
                      rows.filter((row) => row.id !== user.id),
                    );
                  })
                }
              >
                Unblock
              </Button>
            </View>
          ))
        ) : (
          <Text className="text-muted-foreground">No blocked accounts.</Text>
        )}
      </View>
      <View className="gap-3">
        <SectionHeader title="Account data" />
        <Button
          variant="outline"
          disabled={busy}
          onPress={() =>
            void run(async () => {
              const identity = authIdentity(getAuthToken());
              const data = await trpcClient.features.exportData.query();
              if (authIdentity(getAuthToken()) !== identity) return;
              if (!(await Sharing.isAvailableAsync()))
                throw new Error("Sharing is unavailable on this device.");
              const file = new File(Paths.cache, "mafia-account.json");
              try {
                file.create({ overwrite: true });
                file.write(JSON.stringify(data, null, 2));
                await Sharing.shareAsync(file.uri, {
                  mimeType: "application/json",
                  dialogTitle: "Export account data",
                });
              } finally {
                if (file.exists) file.delete();
              }
            })
          }
        >
          Export account data
        </Button>
        <Text className="text-sm text-muted-foreground">
          Deleting your account removes your profile and private messages.
          Shared match records remain with your identity removed.
        </Text>
        <Text className="text-foreground">
          Type DELETE to delete your account
        </Text>
        <Input
          accessibilityLabel="Delete account confirmation"
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="characters"
          editable={!busy}
        />
        <Button
          variant="destructive"
          disabled={busy || confirmation !== "DELETE"}
          onPress={() =>
            void run(async () => {
              const identity = authIdentity(getAuthToken());
              await trpcClient.features.deleteAccount.mutate({
                confirmation: "DELETE",
              });
              if (authIdentity(getAuthToken()) === identity) onDeleted();
            })
          }
        >
          Delete account
        </Button>
      </View>
      {status ? (
        <Text accessibilityRole="alert" className="text-sm text-foreground">
          {status}
        </Text>
      ) : null}
    </View>
  );
}
