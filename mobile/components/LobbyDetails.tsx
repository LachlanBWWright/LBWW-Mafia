import { useEffect, useState } from "react";
import { Text } from "react-native";
import { createUseLobbyInfo } from "../../shared/game/useLobbyInfo";
const useLobbyInfo = createUseLobbyInfo({ useEffect, useState });
const base =
  process.env.EXPO_PUBLIC_TRPC_URL?.replace(/\/api\/trpc\/?$/, "") ??
  "http://localhost:3000";
export function LobbyDetails({ roomId }: { roomId: string }) {
  const { info } = useLobbyInfo(roomId, base);
  if (!info) return null;
  return (
    <Text className="text-sm text-muted-foreground">
      {info.name} · {info.visibility === "public" ? "Public" : "Link-only"}
      {info.hostName ? ` · Host: ${info.hostName}` : ""}
    </Text>
  );
}
