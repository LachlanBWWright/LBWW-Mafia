"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Header } from "~/components/header";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { CheckCircle2, Eye, MessageSquare } from "lucide-react";
import {
  canVoteTarget,
  canWhisperTarget,
  canPerformVisit,
  defaultVisitCapability,
  shouldShowDayOnlyActions,
  shouldShowVisitAction,
  type VisitCapability,
} from "../../../../shared/game/playerActionRules";

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
};
type RoleAssignment = {
  name: string;
  role: string;
  dayVisitSelf: boolean;
  dayVisitOthers: boolean;
  dayVisitFaction: boolean;
  nightVisitSelf: boolean;
  nightVisitOthers: boolean;
  nightVisitFaction: boolean;
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
  const [time, setTime] = useState("Day");
  const [dayNumber, setDayNumber] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [canTalk, setCanTalk] = useState(true);
  const [canVote, setCanVote] = useState(true);
  const [visitCapability, setVisitCapability] =
    useState<VisitCapability>(defaultVisitCapability);
  const [currentUserRole, setCurrentUserRole] = useState<string | undefined>();
  const messageIdRef = useRef(0);
  const isCurrentUserAlive = players.find(
    (player) => player.name === playerName,
  )?.isAlive !== false;

  const socket = useMemo<Socket | null>(
    () => (SOCKET_URL ? io(SOCKET_URL, { autoConnect: false }) : null),
    [],
  );
  const appendLocalMessage = useCallback((message: string) => {
    messageIdRef.current += 1;
    setMessages((current) => [
      ...current,
      { id: messageIdRef.current, text: message },
    ]);
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on("receiveMessage", appendLocalMessage);
    socket.on("receive-chat-message", appendLocalMessage);
    socket.on("receive-whisper-message", appendLocalMessage);
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
      (playerJson: RoleAssignment) => {
        setPlayers((current) =>
          current.map((player) =>
            player.name === playerJson.name
              ? { ...player, isUser: true, role: playerJson.role }
              : player,
          ),
        );
        setCurrentUserRole(playerJson.role);
        setVisitCapability({
          dayVisitSelf: playerJson.dayVisitSelf,
          dayVisitOthers: playerJson.dayVisitOthers,
          dayVisitFaction: playerJson.dayVisitFaction,
          nightVisitSelf: playerJson.nightVisitSelf,
          nightVisitOthers: playerJson.nightVisitOthers,
          nightVisitFaction: playerJson.nightVisitFaction,
        });
      },
    );
    socket.on("update-faction-role", (playerJson: { name: string; role: string }) => {
      setPlayers((current) =>
        current.map((player) =>
          player.name === playerJson.name
            ? { ...player, role: playerJson.role }
            : player,
        ),
      );
    });
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
    });

    return () => {
      socket.off("receiveMessage", appendLocalMessage);
      socket.off("receive-chat-message", appendLocalMessage);
      socket.off("receive-whisper-message", appendLocalMessage);
      socket.off("blockMessages");
      socket.off("disable-voting");
      socket.off("receive-new-player");
      socket.off("remove-player");
      socket.off("receive-player-list");
      socket.off("assign-player-role");
      socket.off("update-player-role");
      socket.off("update-faction-role");
      socket.off("update-day-time");
      socket.disconnect();
    };
  }, [appendLocalMessage, socket]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const joinGame = useCallback(() => {
    if (joining) return;
    if (!SOCKET_URL) {
      setJoinStatus("Socket server URL is not configured.");
      appendLocalMessage("System: Socket server URL is not configured.");
      return;
    }
    if (!CAPTCHA_TOKEN) {
      setJoinStatus("Captcha token is not configured.");
      appendLocalMessage("System: Captcha token is not configured.");
      return;
    }
    if (!socket) {
      setJoinStatus("Socket client is not ready.");
      appendLocalMessage("System: Socket client is not ready.");
      return;
    }
    setJoining(true);
    setJoinStatus("Joining game room...");
    const timeout = setTimeout(() => {
      setJoinStatus("Could not connect to the game server.");
      appendLocalMessage("System: Could not connect to the game server.");
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
          setCurrentUserRole(undefined);
          setVisitCapability(defaultVisitCapability);
          setJoinStatus("");
          setMessages([]);
          messageIdRef.current = 0;
          appendLocalMessage(`System: You joined as ${result}.`);
          setCanTalk(true);
          setCanVote(true);
        } else if (result === JOIN_ERROR.ROOM_FULL) {
          setJoinStatus("Room is full right now. Please try joining again.");
          appendLocalMessage("System: Room is full right now. Please try joining again.");
        } else if (result === JOIN_ERROR.CAPTCHA_FAILED) {
          setJoinStatus("Failed captcha verification.");
          appendLocalMessage("System: Failed captcha verification.");
        } else {
          setJoinStatus("Unable to join room.");
          appendLocalMessage("System: Unable to join room.");
        }
        setJoining(false);
      },
    );
  }, [appendLocalMessage, joining, socket]);

  useEffect(() => {
    if (!playerName && !joining) {
      const autoJoin = setTimeout(() => {
        joinGame();
      }, 0);
      return () => clearTimeout(autoJoin);
    }
  }, [joinGame, playerName, joining]);

  const sendMessage = () => {
    if (!socket || !messageDraft.trim()) return;
    socket.emit("messageSentByUser", messageDraft.trim(), time === "Day");
    setMessageDraft("");
  };

  const voteForPlayer = (index: number) => {
    if (!socket) return;
    if (time !== "Day" || !canVote) return;
    socket.emit("handleVote", index, time === "Day");
  };

  const visitPlayer = (index: number) => {
    if (!socket) return;
    socket.emit("handleVisit", index, time === "Day");
  };

  const whisperToPlayer = (index: number) => {
    if (!socket || !messageDraft.trim()) return;
    socket.emit(
      "handleWhisper",
      index,
      messageDraft.trim(),
      time === "Day",
    );
    setMessageDraft("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto h-[calc(100vh-3.5rem)] w-full max-w-7xl px-4 py-3">
        {!playerName ? (
          <Card className="mx-auto mt-16 max-w-2xl">
            <CardContent className="space-y-3 p-6 text-center">
              <CardTitle className="text-2xl">Connecting to Game Lobby</CardTitle>
              <p className="text-sm text-muted-foreground">
                {joinStatus || "Attempting to join a room now..."}
              </p>
              <Button onClick={joinGame} disabled={joining} className="mx-auto" size="sm">
                {joining ? "Connecting..." : "Retry Connection"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid h-full gap-3 lg:grid-cols-[2fr_1fr]">
            <Card className="h-full">
              <CardContent className="flex h-full flex-col gap-2 p-3">
                <div className="themed-scrollbar flex-1 space-y-1 overflow-y-auto rounded-md border p-2">
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
                 <div className="flex gap-1">
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

            <Card className="h-full">
              <CardHeader className="space-y-2 px-3 pb-1 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{time}</Badge>
                  <Badge variant="outline">Day {dayNumber}</Badge>
                  <Badge variant="outline">Time Left: {timeLeft}s</Badge>
                </div>
                <p className="text-sm text-muted-foreground" aria-label="Assigned player name">
                  You joined as <strong>{playerName}</strong>
                </p>
              </CardHeader>
              <CardContent className="h-[calc(100%-4.75rem)] px-3 pb-3 pt-1">
                <div className="themed-scrollbar h-full space-y-1 overflow-y-auto rounded-md border p-1.5">
                  {players.map((player, index) => {
                    const isDayTime = shouldShowDayOnlyActions(time);
                    const showVisit = shouldShowVisitAction(time, visitCapability);
                    const canVisit = canPerformVisit({
                      time,
                      isSelf: player.name === playerName,
                      targetAlive: player.isAlive !== false,
                      actorAlive: isCurrentUserAlive,
                      actorRole: currentUserRole,
                      targetRole: player.role,
                      capability: visitCapability,
                    });
                    const canVoteAction =
                      canVoteTarget({
                        time,
                        actorAlive: isCurrentUserAlive,
                        targetAlive: player.isAlive !== false,
                        isSelf: player.name === playerName,
                        canVote,
                      }) && isDayTime;
                    const canWhisperAction = canWhisperTarget({
                      time,
                      targetAlive: player.isAlive !== false,
                      isSelf: player.name === playerName,
                      hasMessage: !!messageDraft.trim(),
                    });

                    return (
                    <div
                      key={player.name}
                      aria-label={`${player.name} is ${
                        player.isAlive === false ? "dead" : "alive"
                      }`}
                      className={`flex items-center gap-2 rounded-md border border-border p-1.5 text-sm ${
                        player.isAlive === false
                          ? "bg-destructive/20"
                          : "bg-secondary/40"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">
                            {player.name}
                            {player.name === playerName ? " (You)" : ""}
                      </span>
                      <div className="flex items-center gap-1">
                        {showVisit ? (
                          <Button
                            onClick={() => visitPlayer(index)}
                            disabled={!canVisit}
                            size="icon"
                            title="Visit"
                            aria-label="Visit player"
                            className="h-7 w-7"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        {shouldShowDayOnlyActions(time) ? (
                          <Button
                            onClick={() => voteForPlayer(index)}
                            disabled={!canVoteAction}
                            variant="secondary"
                            size="icon"
                            title="Vote"
                            aria-label="Vote player"
                            className="h-7 w-7"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        {shouldShowDayOnlyActions(time) ? (
                          <Button
                            onClick={() => whisperToPlayer(index)}
                            disabled={!canWhisperAction}
                            variant="outline"
                            size="icon"
                            title="Whisper using draft"
                            aria-label="Whisper to player"
                            className="h-7 w-7"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
