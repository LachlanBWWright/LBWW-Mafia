"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Header } from "~/components/header";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";

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

type Player = {
  name: string;
  isAlive?: boolean;
  role?: string;
  isUser?: boolean;
};
type ChatMessage = {
  id: number;
  text: string;
};

export default function LobbyPage() {
  const [joinStatus, setJoinStatus] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [joining, setJoining] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<number | null>(null);
  const [time, setTime] = useState("Day");
  const [dayNumber, setDayNumber] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [canTalk, setCanTalk] = useState(true);
  const [canVote, setCanVote] = useState(true);
  const messageIdRef = useRef(0);

  const socket = useMemo<Socket | null>(
    () => (SOCKET_URL ? io(SOCKET_URL, { autoConnect: false }) : null),
    [],
  );

  useEffect(() => {
    if (!socket) return;

    const appendMessage = (message: string) => {
      messageIdRef.current += 1;
      setMessages((current) => [
        ...current,
        { id: messageIdRef.current, text: message },
      ]);
    };

    socket.on("receiveMessage", appendMessage);
    socket.on("receive-chat-message", appendMessage);
    socket.on("receive-whisper-message", appendMessage);
    socket.on("blockMessages", () => setCanTalk(false));
    socket.on("disable-voting", () => setCanVote(false));
    socket.on("receive-new-player", (playerJson: { name: string }) => {
      setPlayers((current) => [...current, { name: playerJson.name }]);
    });
    socket.on("remove-player", (playerJson: { name: string }) => {
      setPlayers((current) =>
        current.filter((player) => player.name !== playerJson.name),
      );
    });
    socket.on(
      "receive-player-list",
      (listJson: { name: string; isAlive?: boolean; role?: string }[]) => {
        setPlayers(listJson);
      },
    );
    socket.on(
      "assign-player-role",
      (playerJson: { name: string; role: string }) => {
        setPlayers((current) =>
          current.map((player) =>
            player.name === playerJson.name
              ? { ...player, isUser: true, role: playerJson.role }
              : player,
          ),
        );
      },
    );
    socket.on("update-player-role", (playerJson: { name: string; role?: string }) => {
      setPlayers((current) =>
        current.map((player) =>
          player.name === playerJson.name
            ? { ...player, isAlive: false, role: playerJson.role ?? player.role }
            : player,
        ),
      );
    });
    socket.on("update-day-time", (infoJson: { time: string; dayNumber: number; timeLeft: number }) => {
      setTime(infoJson.time);
      setDayNumber(infoJson.dayNumber);
      setTimeLeft(infoJson.timeLeft);
      setSelectedRecipient(null);
    });

    return () => {
      socket.off("receiveMessage", appendMessage);
      socket.off("receive-chat-message", appendMessage);
      socket.off("receive-whisper-message", appendMessage);
      socket.off("blockMessages");
      socket.off("disable-voting");
      socket.off("receive-new-player");
      socket.off("remove-player");
      socket.off("receive-player-list");
      socket.off("assign-player-role");
      socket.off("update-player-role");
      socket.off("update-day-time");
      socket.disconnect();
    };
  }, [socket]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

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
          setMessages([]);
          setCanTalk(true);
          setCanVote(true);
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

  const sendMessage = () => {
    if (!socket || !messageDraft.trim()) return;
    socket.emit("messageSentByUser", messageDraft.trim(), time === "Day");
    setMessageDraft("");
  };

  const voteForPlayer = () => {
    if (!socket || selectedRecipient === null || !canVote) return;
    socket.emit("handleVote", selectedRecipient, time === "Day");
  };

  const visitPlayer = () => {
    if (!socket || selectedRecipient === null) return;
    socket.emit("handleVisit", selectedRecipient, time === "Day");
  };

  const whisperToPlayer = () => {
    if (!socket || selectedRecipient === null || !messageDraft.trim()) return;
    socket.emit(
      "handleWhisper",
      selectedRecipient,
      messageDraft.trim(),
      time === "Day",
    );
    setMessageDraft("");
  };

  const selectedPlayer =
    selectedRecipient !== null ? players[selectedRecipient] : undefined;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{time}</Badge>
            <Badge variant="outline">Day {dayNumber}</Badge>
            <Badge variant="outline">Time Left: {timeLeft}s</Badge>
          </div>
          {playerName ? (
            <p className="text-sm" aria-label="Assigned player name">
              You joined as <strong>{playerName}</strong>
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Game Chat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!playerName ? (
                <Button onClick={joinGame} disabled={joining} className="w-full" size="lg">
                  {joining ? "Joining..." : "Join Game"}
                </Button>
              ) : null}
              {joinStatus ? (
                <p className="text-sm text-muted-foreground">{joinStatus}</p>
              ) : null}
              <div className="max-h-[50vh] space-y-2 overflow-y-auto rounded-md border p-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No messages yet.
                  </p>
                ) : (
                  messages.map((message) => (
                    <p key={message.id} className="text-sm">
                      {message.text}
                    </p>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder={canTalk ? "Send a message..." : "You cannot talk right now"}
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  disabled={!canTalk}
                />
                <Button onClick={sendMessage} disabled={!canTalk || !messageDraft.trim()}>
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Players</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-[34vh] space-y-2 overflow-y-auto rounded-md border p-2">
                {players.map((player, index) => (
                  <button
                    key={player.name}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                      selectedRecipient === index
                        ? "border-primary bg-primary/10"
                        : "border-border"
                    }`}
                    onClick={() => setSelectedRecipient(index)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        {player.name}
                        {player.name === playerName ? " (You)" : ""}
                      </span>
                      <Badge variant={player.isAlive === false ? "destructive" : "secondary"}>
                        {player.isAlive === false ? "Dead" : "Alive"}
                      </Badge>
                    </div>
                    {player.role ? (
                      <p className="mt-1 text-xs text-muted-foreground">Role: {player.role}</p>
                    ) : null}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedPlayer ? selectedPlayer.name : "None"}
                </p>
                <div className="grid grid-cols-1 gap-2">
                  <Button onClick={visitPlayer} disabled={selectedRecipient === null}>
                    Visit
                  </Button>
                  <Button
                    onClick={voteForPlayer}
                    disabled={selectedRecipient === null || !canVote}
                    variant="secondary"
                  >
                    Vote
                  </Button>
                  <Button
                    onClick={whisperToPlayer}
                    disabled={selectedRecipient === null || !messageDraft.trim()}
                    variant="outline"
                  >
                    Whisper using draft
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
