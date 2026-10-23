"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "~/server/trpc/router";
import type { SocialUser } from "@mernmafia/shared/trpc/appRouter";
import {
  MAX_PARTY_MEMBERS,
  type PartyInvitation,
  type PartySummary,
} from "@mernmafia/shared/trpc/parties";
import {
  createUseLobbyGroup,
  type LobbyGroupAction,
} from "@mernmafia/shared/game/useLobbyGroup";
import {
  createLobbyLink,
  isLobbyRoomId,
} from "@mernmafia/shared/game/lobbyLinks";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const useLobbyGroup = createUseLobbyGroup({
  useCallback,
  useEffect,
  useRef,
  useState,
});
const makeClient = () =>
  createTRPCProxyClient<AppRouter>({
    links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
  });

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
    <section aria-label="Party" className="space-y-4 border-t py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Party</h2>
        <div className="flex gap-2">
          {onShareLobby && roomId && isLobbyRoomId(roomId) ? (
            <Button size="sm" variant="outline" onClick={onShareLobby}>
              Share lobby
            </Button>
          ) : null}
          {onRefresh ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || loading}
              onClick={onRefresh}
            >
              Refresh party
            </Button>
          ) : null}
        </div>
      </div>
      {loading ? (
        <p role="status" className="text-muted-foreground text-sm">
          Loading party…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-foreground text-sm">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-sm">
          {status}
        </p>
      ) : null}
      {invitations.map((invitation) => (
        <div
          key={invitation.id}
          className="flex flex-wrap items-center justify-between gap-2"
        >
          <p className="text-sm">
            {invitation.senderName ?? "A player"} invited you to their party.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || !!party}
              onClick={() =>
                onAction({ type: "respond", id: invitation.id, accept: true })
              }
            >
              Accept party invitation
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                onAction({ type: "respond", id: invitation.id, accept: false })
              }
            >
              Decline
            </Button>
          </div>
        </div>
      ))}
      {invitations.length > 0 && party ? (
        <p className="text-muted-foreground text-sm">
          Leave your current party to accept another invitation.
        </p>
      ) : null}
      {!loading && !party && !error ? (
        <Button disabled={busy} onClick={() => onAction({ type: "create" })}>
          Create party
        </Button>
      ) : null}
      {party ? (
        <>
          <ul className="divide-y">
            {party.members.map((member) => (
              <li
                key={member.userId}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {member.name ?? member.handle ?? "Player"}
                    {member.userId === userId ? " (you)" : ""}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {member.userId === party.leaderId
                      ? "Party leader"
                      : member.handle
                        ? `@${member.handle}`
                        : "Member"}
                  </p>
                </div>
                {leader && member.userId !== userId ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        onAction({ type: "transfer", userId: member.userId })
                      }
                    >
                      Make leader
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        onAction({ type: "kick", userId: member.userId })
                      }
                    >
                      Remove from party
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">
              {party.roomId
                ? `Party lobby: ${party.roomId}`
                : "No party lobby selected."}
            </p>
            {party.roomId && party.roomId !== roomId ? (
              <Button size="sm" onClick={() => onFollowRoom(party.roomId!)}>
                Join party lobby
              </Button>
            ) : null}
            {party.roomId && party.roomId === roomId ? (
              <span className="text-muted-foreground text-sm">
                Current lobby
              </span>
            ) : null}
          </div>
          {leader ? (
            <>
              {roomId && isLobbyRoomId(roomId) && roomId !== party.roomId ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => onAction({ type: "move", roomId })}
                >
                  Set this lobby as party destination
                </Button>
              ) : null}
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const target = destination.trim();
                  if (isLobbyRoomId(target))
                    onAction({ type: "move", roomId: target });
                }}
              >
                <Input
                  aria-label="Party lobby ID"
                  placeholder="Lobby ID"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  maxLength={64}
                  className="min-w-40 flex-1"
                />
                <Button disabled={busy || !isLobbyRoomId(destination.trim())}>
                  Set party lobby
                </Button>
              </form>
              {availableFriends.length ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Invite friends</h3>
                  {availableFriends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <p className="text-sm">
                        {friend.name ?? friend.handle ?? "Player"}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          busy || party.members.length >= MAX_PARTY_MEMBERS
                        }
                        onClick={() =>
                          onAction({ type: "invite", recipientId: friend.id })
                        }
                      >
                        Invite to party
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
              {party.members.length >= MAX_PARTY_MEMBERS ? (
                <p className="text-muted-foreground text-sm">
                  Your party is full.
                </p>
              ) : null}
            </>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onAction({ type: "leave" })}
          >
            Leave party
          </Button>
        </>
      ) : null}
    </section>
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
  const [client] = useState(makeClient);
  const state = useLobbyGroup(client);
  const [shareStatus, setShareStatus] = useState("");
  const share = () => {
    if (!roomId) return;
    const url = createLobbyLink(window.location.origin, roomId);
    if (onShareLobby) onShareLobby(url);
    else
      void navigator.clipboard
        .writeText(url)
        .then(() => setShareStatus("Lobby link copied."))
        .catch(() => setShareStatus("Unable to copy the lobby link."));
  };
  return (
    <LobbyGroupView
      {...state}
      status={shareStatus ? shareStatus : state.status}
      roomId={roomId}
      onFollowRoom={onFollowRoom}
      onShareLobby={share}
      onAction={(action) => {
        setShareStatus("");
        void state.act(action);
      }}
      onRefresh={() => void state.refresh()}
    />
  );
}
