import React, { useCallback, useEffect, useRef, useState } from "react";
import { Share, Text, View } from "react-native";
import type { SocialUser } from "../../shared/trpc/appRouter";
import {
  MAX_PARTY_MEMBERS,
  type PartyInvitation,
  type PartySummary,
} from "../../shared/trpc/parties";
import {
  createUseLobbyGroup,
  type LobbyGroupAction,
} from "../../shared/game/useLobbyGroup";
import { createLobbyLink, isLobbyRoomId } from "../../shared/game/lobbyLinks";
import { trpcClient } from "../lib/trpc";
import { runInForeground } from "../lib/foreground";
import { Button, Input } from "./ui";

const useLobbyGroup = createUseLobbyGroup({
  useCallback,
  useEffect,
  useRef,
  useState,
});
const subscribe = (refresh: () => void) => runInForeground(refresh, 10_000);

export type LobbyGroupViewProps = {
  party: PartySummary | null;
  invitations: PartyInvitation[];
  friends: SocialUser[];
  userId: string;
  roomId?: string;
  loading?: boolean;
  busy?: boolean;
  status?: string;
  error?: string;
  onAction: (action: LobbyGroupAction) => void;
  onFollowRoom: (roomId: string) => void;
  onShareLobby?: () => void;
  onRefresh?: () => void;
};

export function LobbyGroupView({
  party,
  invitations,
  friends,
  userId,
  roomId,
  loading = false,
  busy = false,
  status,
  error,
  onAction,
  onFollowRoom,
  onShareLobby,
  onRefresh,
}: LobbyGroupViewProps) {
  const [destination, setDestination] = useState("");
  const leader = party?.leaderId === userId;
  const availableFriends = friends.filter(
    (friend) => !party?.members.some((member) => member.userId === friend.id),
  );
  return (
    <View
      accessibilityLabel="Party"
      className="gap-4 border-t border-border py-5"
    >
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="text-lg font-semibold text-foreground">Party</Text>
        <View className="flex-row gap-2">
          {onShareLobby && roomId && isLobbyRoomId(roomId) ? (
            <Button size="sm" variant="outline" onPress={onShareLobby}>
              Share lobby
            </Button>
          ) : null}
          {onRefresh ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || loading}
              onPress={onRefresh}
            >
              Refresh party
            </Button>
          ) : null}
        </View>
      </View>
      {loading ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-sm text-muted-foreground"
        >
          Loading party…
        </Text>
      ) : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          className="text-sm font-medium text-foreground"
        >
          {error}
        </Text>
      ) : null}
      {status ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-sm text-foreground"
        >
          {status}
        </Text>
      ) : null}
      {invitations.map((invitation) => (
        <View key={invitation.id} className="gap-2">
          <Text className="text-sm text-foreground">
            {invitation.senderName ?? "A player"} invited you to their party.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy || !!party}
              onPress={() =>
                onAction({ type: "respond", id: invitation.id, accept: true })
              }
            >
              Accept party invitation
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onPress={() =>
                onAction({ type: "respond", id: invitation.id, accept: false })
              }
            >
              Decline
            </Button>
          </View>
        </View>
      ))}
      {invitations.length > 0 && party ? (
        <Text className="text-sm text-muted-foreground">
          Leave your current party to accept another invitation.
        </Text>
      ) : null}
      {!loading && !party && !error ? (
        <Button disabled={busy} onPress={() => onAction({ type: "create" })}>
          Create party
        </Button>
      ) : null}
      {party ? (
        <>
          <View>
            {party.members.map((member) => (
              <View
                key={member.userId}
                className="gap-2 border-b border-border py-2"
              >
                <Text className="text-sm font-medium text-foreground">
                  {member.name ?? member.handle ?? "Player"}
                  {member.userId === userId ? " (you)" : ""}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {member.userId === party.leaderId
                    ? "Party leader"
                    : member.handle
                      ? `@${member.handle}`
                      : "Member"}
                </Text>
                {leader && member.userId !== userId ? (
                  <View className="flex-row flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onPress={() =>
                        onAction({ type: "transfer", userId: member.userId })
                      }
                    >
                      Make leader
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onPress={() =>
                        onAction({ type: "kick", userId: member.userId })
                      }
                    >
                      Remove from party
                    </Button>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
          <Text className="text-sm text-foreground">
            {party.roomId
              ? `Party lobby: ${party.roomId}`
              : "No party lobby selected."}
          </Text>
          {party.roomId && party.roomId !== roomId ? (
            <Button size="sm" onPress={() => onFollowRoom(party.roomId!)}>
              Join party lobby
            </Button>
          ) : null}
          {party.roomId && party.roomId === roomId ? (
            <Text className="text-sm text-muted-foreground">Current lobby</Text>
          ) : null}
          {leader ? (
            <>
              {roomId && isLobbyRoomId(roomId) && roomId !== party.roomId ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onPress={() => onAction({ type: "move", roomId })}
                >
                  Set this lobby as party destination
                </Button>
              ) : null}
              <Input
                accessibilityLabel="Party lobby ID"
                placeholder="Lobby ID"
                value={destination}
                onChangeText={setDestination}
                maxLength={64}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button
                disabled={busy || !isLobbyRoomId(destination.trim())}
                onPress={() =>
                  onAction({ type: "move", roomId: destination.trim() })
                }
              >
                Set party lobby
              </Button>
              {availableFriends.length ? (
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">
                    Invite friends
                  </Text>
                  {availableFriends.map((friend) => (
                    <View
                      key={friend.id}
                      className="flex-row items-center justify-between gap-2"
                    >
                      <Text className="flex-1 text-sm text-foreground">
                        {friend.name ?? friend.handle ?? "Player"}
                      </Text>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          busy || party.members.length >= MAX_PARTY_MEMBERS
                        }
                        onPress={() =>
                          onAction({ type: "invite", recipientId: friend.id })
                        }
                      >
                        Invite to party
                      </Button>
                    </View>
                  ))}
                </View>
              ) : null}
              {party.members.length >= MAX_PARTY_MEMBERS ? (
                <Text className="text-sm text-muted-foreground">
                  Your party is full.
                </Text>
              ) : null}
            </>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onPress={() => onAction({ type: "leave" })}
          >
            Leave party
          </Button>
        </>
      ) : null}
    </View>
  );
}

export function LobbyGroupPanel({
  roomId,
  onFollowRoom,
  onShareLobby,
}: {
  roomId?: string;
  onFollowRoom: (roomId: string) => void;
  onShareLobby?: (url: string) => void;
}) {
  const state = useLobbyGroup(trpcClient, subscribe);
  const [shareError, setShareError] = useState("");
  const share = () => {
    if (!roomId) return;
    const origin =
      process.env.EXPO_PUBLIC_WEBSITE_URL ??
      process.env.EXPO_PUBLIC_TRPC_URL ??
      "http://localhost:3000";
    try {
      const url = createLobbyLink(origin, roomId);
      if (onShareLobby) onShareLobby(url);
      else
        void Share.share({ message: url, url }).catch(() =>
          setShareError("Unable to share the lobby link."),
        );
    } catch {
      setShareError("Unable to share the lobby link.");
    }
  };
  return (
    <LobbyGroupView
      {...state}
      error={shareError ? shareError : state.error}
      roomId={roomId}
      onFollowRoom={onFollowRoom}
      onShareLobby={share}
      onAction={(action) => {
        setShareError("");
        void state.act(action);
      }}
      onRefresh={() => void state.refresh()}
    />
  );
}
