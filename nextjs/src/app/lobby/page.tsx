"use client";

import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Header } from "~/components/header";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");
const CAPTCHA_TOKEN =
  process.env.NEXT_PUBLIC_CAPTCHA_TOKEN ??
  (process.env.NODE_ENV === "development" ? "dev-bypass-token" : "");

const JOIN_ERROR = {
  CAPTCHA_FAILED: 2,
  ROOM_FULL: 3,
} as const;

export default function LobbyPage() {
  const [joinStatus, setJoinStatus] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [joining, setJoining] = useState(false);

  const socket = useMemo<Socket | null>(
    () =>
    SOCKET_URL ? io(SOCKET_URL, { autoConnect: false }) : null,
    [],
  );

  useEffect(() => {
    return () => {
      socket?.disconnect();
    };
  }, [socket]);

  const joinGame = () => {
    if (joining) return;
    if (!SOCKET_URL) {
      setJoinStatus("Socket server URL is not configured.");
      return;
    }
    if (!CAPTCHA_TOKEN) {
      setJoinStatus("Captcha token is not configured.");
      return;
    }
    if (!socket) {
      setJoinStatus("Socket client is not ready.");
      return;
    }
    setJoining(true);
    setJoinStatus("Joining room...");
    const timeout = setTimeout(() => {
      setJoinStatus("Could not connect to the game server.");
      setJoining(false);
    }, 7000);

    socket.connect();
    socket.emit(
      "playerJoinRoom",
      CAPTCHA_TOKEN,
      (result: string | number) => {
        clearTimeout(timeout);
        if (typeof result === "string") {
          setPlayerName(result);
          setJoinStatus("Joined successfully.");
        } else if (result === JOIN_ERROR.ROOM_FULL) {
          setJoinStatus("Room is full right now. Please try joining again.");
        } else if (result === JOIN_ERROR.CAPTCHA_FAILED) {
          setJoinStatus("Failed captcha verification.");
        } else {
          setJoinStatus("Unable to join room.");
        }
        setJoining(false);
      },
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">Game Lobby</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Join a live room. The backend will place you in the current room
                or create a new one when the room is full.
              </p>
              <Button onClick={joinGame} disabled={joining} className="w-full" size="lg">
                {joining ? "Joining..." : "Join Game"}
              </Button>
              {joinStatus ? (
                <p className="text-sm text-muted-foreground">{joinStatus}</p>
              ) : null}
              {playerName ? (
                <p className="text-sm" aria-label="Assigned player name">
                  You joined as: <strong>{playerName}</strong>
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
