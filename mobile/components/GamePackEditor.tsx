import { createGamePackLink, readTransferredGamePack } from "../lib/gamePackTransfer";
import React, { useState } from "react";
import { Share, Text, View } from "react-native";
import type { LobbyConfig } from "../../shared/game/lobbyConfig";
import { createGamePack, exportGamePack } from "../../shared/game/gameCustomization";
import { Button, Input, SectionHeader } from "./ui";
export function GamePackEditor({ getConfig, onApply }: { getConfig: () => LobbyConfig; onApply: (config: LobbyConfig) => void }) {
  const [name, setName] = useState("My game pack");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  function run(action: () => void) { try { action(); setStatus(""); } catch (cause) { setStatus(cause instanceof Error ? cause.message : "Unable to read game pack."); } }
  function exportPack() { run(() => setText(exportGamePack(createGamePack(name, getConfig())))); }
  function importPack() { run(() => { const pack = readTransferredGamePack(text); onApply(pack.config); setName(pack.name); }); }
  async function sharePack() {
    try { const message = exportGamePack(createGamePack(name, getConfig())); setText(message); const url = createGamePackLink(name, getConfig(), process.env.EXPO_PUBLIC_WEB_URL ?? "https://mern-mafia.vercel.app"); await Share.share({ title: name, message: url }); setStatus(""); }
    catch (cause) { setStatus(cause instanceof Error ? cause.message : "Unable to share game pack."); }
  }
  return <View className="gap-3 border-b border-border pb-5"><SectionHeader title="Share game packs" /><Input accessibilityLabel="Game pack name" value={name} onChangeText={setName} maxLength={80} /><Input accessibilityLabel="Game pack JSON" multiline numberOfLines={5} value={text} onChangeText={setText} placeholder="Paste a game pack or shared link" /><View className="flex-row flex-wrap gap-2"><Button variant="outline" onPress={exportPack}>Export pack</Button><Button variant="outline" onPress={importPack} disabled={!text.trim()}>Import pack</Button><Button variant="outline" onPress={() => void sharePack()}>Share pack</Button></View>{status ? <Text accessibilityRole="alert" className="text-destructive">{status}</Text> : null}</View>;
}
