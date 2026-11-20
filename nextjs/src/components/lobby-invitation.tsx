"use client";
import { useEffect, useState } from "react";
import { createUseLobbyInfo } from "@mernmafia/shared/game/useLobbyInfo";
import type { LobbyInvitation } from "@mernmafia/shared/trpc/accountFeatures";
import { Button } from "./ui/button";
const useLobbyInfo = createUseLobbyInfo({ useEffect, useState });
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
  const { info, status } = useLobbyInfo(invite.roomId, "", !expired);
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
    <div className="space-y-2 border-b py-3">
      <p>
        {invite.senderName ?? "A friend"} invited you to{" "}
        {info?.name ?? "a lobby"}.
      </p>
      <p className="text-muted-foreground text-sm">
        {info ? `Players (${info.players}/${info.capacity}) · ` : ""}
        {label}
      </p>
      <div className="flex gap-2">
        {!expired ? (
          <>
            <Button
              disabled={(busy ?? false) || info?.status !== "waiting"}
              onClick={() => onRespond(invite.id, true)}
            >
              Join
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => onRespond(invite.id, false)}
            >
              Decline
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
