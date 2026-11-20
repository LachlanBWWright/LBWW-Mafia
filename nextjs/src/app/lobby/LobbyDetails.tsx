"use client";
import { useEffect, useState } from "react";
import { createUseLobbyInfo } from "@mernmafia/shared/game/useLobbyInfo";
const useLobbyInfo = createUseLobbyInfo({ useEffect, useState });
export function LobbyDetails({ roomId }: { roomId: string }) {
  const { info } = useLobbyInfo(roomId);
  if (!info) return null;
  return (
    <p className="text-muted-foreground px-4 py-2 text-sm">
      {info.name} · {info.visibility === "public" ? "Public" : "Link-only"}
      {info.hostName ? ` · Host: ${info.hostName}` : ""}
    </p>
  );
}
