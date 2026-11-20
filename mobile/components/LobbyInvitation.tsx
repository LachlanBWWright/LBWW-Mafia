import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { createUseLobbyInfo } from "../../shared/game/useLobbyInfo";
import type { LobbyInvitation } from "../../shared/trpc/accountFeatures";
import { Button } from "./ui";
const useLobbyInfo = createUseLobbyInfo({ useEffect, useState });
const base =
  process.env.EXPO_PUBLIC_TRPC_URL?.replace(/\/api\/trpc\/?$/, "") ??
  "http://localhost:3000";
export function LobbyInvitationCard({
  invite,
  busy,
  onRespond,
}: {
  invite: LobbyInvitation;
  busy?: boolean;
  onRespond: (id: number, accept: boolean) => void;
}) {
  const expired = invite.status === "expired";
  const { info, status } = useLobbyInfo(invite.roomId, base, !expired);
  const label = expired
    ? "Invitation expired"
    : status === "loading"
      ? "Checking lobby…"
      : !info
        ? "Lobby unavailable"
        : info.status === "waiting"
          ? "Waiting"
          : info.status === "in-progress"
            ? "Game started"
            : info.status === "full"
              ? "Lobby full"
              : info.status === "closed"
                ? "Lobby closed"
                : "Game finished";
  return (
    <View className="gap-2 border-b border-border py-3">
      <Text className="text-foreground">
        {invite.senderName ?? "A friend"} invited you to{" "}
        {info?.name ?? "a lobby"}.
      </Text>
      <Text className="text-sm text-muted-foreground">
        {info ? `Players (${info.players}/${info.capacity}) · ` : ""}
        {label}
      </Text>
      {!expired ? (
        <View className="flex-row gap-2">
          <Button
            disabled={(busy ?? false) || info?.status !== "waiting"}
            onPress={() => onRespond(invite.id, true)}
          >
            Join
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onPress={() => onRespond(invite.id, false)}
          >
            Decline
          </Button>
        </View>
      ) : null}
    </View>
  );
}
