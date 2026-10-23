import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { LobbyPreset } from "../../shared/trpc/accountFeatures";
import type { LobbyConfig } from "../../shared/game/lobbyConfig";
import { trpcClient } from "../lib/trpc";
import { Button, Input, SectionHeader } from "./ui";
export function LobbyPresets({
  getConfig,
  onApply,
  initialPresets,
}: {
  getConfig: () => LobbyConfig;
  onApply: (config: LobbyConfig) => void;
  initialPresets?: LobbyPreset[];
}) {
  const [presets, setPresets] = useState(initialPresets ?? []),
    [name, setName] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initialPresets) return;
    let active = true;
    void trpcClient.features.presets
      .query()
      .then((p) => {
        if (active) setPresets(p);
      })
      .catch(() => {
        if (active) setStatus("Unable to load saved presets.");
      });
    return () => {
      active = false;
    };
  }, [initialPresets]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      await action();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Unable to save preset.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <View className="gap-3 border-b border-border pb-5">
      <SectionHeader title="Saved presets" />
      <Text className="text-foreground">Preset name</Text>
      <Input
        accessibilityLabel="Preset name"
        value={name}
        onChangeText={setName}
        maxLength={60}
        editable={!busy}
      />
      <Button
        variant="outline"
        disabled={busy || !name.trim()}
        onPress={() =>
          void run(async () => {
            const preset = await trpcClient.features.savePreset.mutate({
              name: name.trim(),
              config: getConfig(),
            });
            setPresets((p) => [...p, preset]);
            setName("");
            setStatus("Preset saved.");
          })
        }
      >
        Save current rules
      </Button>
      {presets.length ? (
        presets.map((p) => (
          <View key={p.id} className="gap-2 border-b border-border pb-3">
            <Text className="text-foreground">
              {p.name} · {p.config.size} players
            </Text>
            <View className="flex-row gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onPress={() => {
                  onApply(p.config);
                  setStatus(`${p.name} loaded.`);
                }}
              >
                Load
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    await trpcClient.features.deletePreset.mutate({ id: p.id });
                    setPresets((rows) => rows.filter((row) => row.id !== p.id));
                  })
                }
              >
                Delete
              </Button>
            </View>
          </View>
        ))
      ) : (
        <Text className="text-sm text-muted-foreground">No saved presets.</Text>
      )}
      {status ? (
        <Text accessibilityRole="alert" className="text-sm text-foreground">
          {status}
        </Text>
      ) : null}
    </View>
  );
}
