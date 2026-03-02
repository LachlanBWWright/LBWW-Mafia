"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SocketIoClientAdapter } from "@mernmafia/shared/communication/socketIoClientAdapter";
import { PartykitClientAdapter } from "@mernmafia/shared/communication/partykitClientAdapter";
import type { PlayerList, PlayerReturned } from "@mernmafia/shared/communication/events";
import type { DayTime, VisitCapability } from "@mernmafia/shared/game/playerActionRules";
import { defaultVisitCapability } from "@mernmafia/shared/game/playerActionRules";
import type { GameSocket, SocketBackendType } from "@mernmafia/shared/communication/clientTypes";

function resolveBackend(value: string | undefined): SocketBackendType {
  return value === "partykit" ? "partykit" : "socketio";
}

const SOCKET_BACKEND = resolveBackend(process.env.NEXT_PUBLIC_SOCKET_BACKEND);
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "";
const CAPTCHA_TOKEN =
  process.env.NEXT_PUBLIC_CAPTCHA_TOKEN ??
  (process.env.NODE_ENV === "development" ? "dev-bypass-token" : "");
const PARTYKIT_ROOM = process.env.NEXT_PUBLIC_PARTYKIT_ROOM ?? "default";

const JOIN_ERROR = { CAPTCHA_FAILED: 2, ROOM_FULL: 3 } as const;

export type Player = { name: string; isAlive?: boolean; role?: string };
type ChatMessage = { id: number; text: string };

function buildSocket(): GameSocket | null {
  if (!SOCKET_URL) return null;
  if (SOCKET_BACKEND === "partykit") {
    const wsUrl = SOCKET_URL.replace(/^https?/, "ws");
    return new PartykitClientAdapter(`${wsUrl}/party/${PARTYKIT_ROOM}`, false);
  }
  const raw = io(SOCKET_URL, { autoConnect: false });
  return new SocketIoClientAdapter(raw);
}

export type GameLobbyState = {
  joinStatus: string;
  playerName: string;
  joining: boolean;
  players: Player[];
  messages: ChatMessage[];
  messageDraft: string;
  time: DayTime;
  dayNumber: number;
  timeLeft: number;
  canTalk: boolean;
  canVote: boolean;
  visitCapability: VisitCapability;
  currentUserRole: string | undefined;
};

export type GameLobbyActions = {
  joinGame: () => void;
  sendMessage: () => void;
  voteForPlayer: (index: number) => void;
  visitPlayer: (index: number) => void;
  whisperToPlayer: (index: number) => void;
  setMessageDraft: (draft: string) => void;
};

type JoinContext = {
  socket: GameSocket;
  joiningRef: { current: boolean };
  playerNameRef: { current: string };
  msgIdRef: { current: number };
  setJoinStatus: (s: string) => void;
  setJoining: (b: boolean) => void;
  setPlayerName: (n: string) => void;
  setCurrentUserRole: (r: string | undefined) => void;
  setVisitCapability: (v: VisitCapability) => void;
  setMessages: (fn: (cur: ChatMessage[]) => ChatMessage[]) => void;
  setCanTalk: (b: boolean) => void;
  setCanVote: (b: boolean) => void;
};

function performJoin(ctx: JoinContext) {
  if (ctx.joiningRef.current) return;
  if (!SOCKET_URL) { ctx.setJoinStatus("Socket server URL is not configured."); return; }
  if (!CAPTCHA_TOKEN) { ctx.setJoinStatus("Captcha token is not configured."); return; }
  ctx.joiningRef.current = true;
  ctx.setJoining(true);
  ctx.setJoinStatus("Joining game room...");
  const timeout = setTimeout(() => {
    ctx.setJoinStatus("Could not connect to the game server.");
    ctx.joiningRef.current = false;
    ctx.setJoining(false);
  }, 7000);
  ctx.socket.connect();
  ctx.socket.emit("playerJoinRoom", CAPTCHA_TOKEN, (result: string | number) => {
    clearTimeout(timeout);
    if (typeof result === "string") {
      ctx.playerNameRef.current = result;
      ctx.setPlayerName(result);
      ctx.setCurrentUserRole(undefined);
      ctx.setVisitCapability(defaultVisitCapability);
      ctx.setJoinStatus("");
      ctx.setMessages(() => []);
      ctx.msgIdRef.current = 0;
      ctx.setCanTalk(true);
      ctx.setCanVote(true);
    } else if (result === JOIN_ERROR.ROOM_FULL) {
      ctx.setJoinStatus("Room is full. Please try again.");
    } else if (result === JOIN_ERROR.CAPTCHA_FAILED) {
      ctx.setJoinStatus("Failed captcha verification.");
    } else {
      ctx.setJoinStatus("Unable to join room.");
    }
    ctx.joiningRef.current = false;
    ctx.setJoining(false);
  });
}

export function useGameLobby(): GameLobbyState & GameLobbyActions {
  const [joinStatus, setJoinStatus] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [joining, setJoining] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [time, setTime] = useState<DayTime>("Day");
  const [dayNumber, setDayNumber] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [canTalk, setCanTalk] = useState(true);
  const [canVote, setCanVote] = useState(true);
  const [visitCapability, setVisitCapability] = useState<VisitCapability>(defaultVisitCapability);
  const [currentUserRole, setCurrentUserRole] = useState<string | undefined>();

  // Socket is created once via lazy useState initializer (never changes after mount)
  const [socket] = useState<GameSocket | null>(() => buildSocket());

  const msgIdRef = useRef(0);
  const joiningRef = useRef(false);
  const playerNameRef = useRef("");

  // Socket setup runs once on mount (socket is stable — never reassigned after init)
  useEffect(() => {
    if (!socket) return;

    const appendMsg = (text: string) => {
      msgIdRef.current += 1;
      const id = msgIdRef.current;
      setMessages((cur) => (cur.some((m) => m.id === id) ? cur : [...cur, { id, text }]));
    };

    const joinCtx: JoinContext = {
      socket, joiningRef, playerNameRef, msgIdRef,
      setJoinStatus, setJoining, setPlayerName, setCurrentUserRole,
      setVisitCapability, setMessages, setCanTalk, setCanVote,
    };

    const onNewPlayer = (p: { name: string }) =>
      setPlayers((cur) => (cur.some((x) => x.name === p.name) ? cur : [...cur, { name: p.name }]));
    const onRemovePlayer = (p: { name: string }) =>
      setPlayers((cur) => cur.filter((x) => x.name !== p.name));
    const onPlayerList = (list: PlayerList[]) => setPlayers(list);
    const onAssignRole = (data: PlayerReturned) => {
      setPlayers((cur) => cur.map((p) => (p.name === data.name ? { ...p, role: data.role } : p)));
      setCurrentUserRole(data.role);
      setVisitCapability({
        dayVisitSelf: data.dayVisitSelf, dayVisitOthers: data.dayVisitOthers,
        dayVisitFaction: data.dayVisitFaction, nightVisitSelf: data.nightVisitSelf,
        nightVisitOthers: data.nightVisitOthers, nightVisitFaction: data.nightVisitFaction,
      });
    };
    const onFactionRole = (d: { name: string; role: string }) =>
      setPlayers((cur) => cur.map((p) => (p.name === d.name ? { ...p, role: d.role } : p)));
    const onUpdateRole = (d: { name: string; role?: string }) =>
      setPlayers((cur) =>
        cur.map((p) => (p.name === d.name ? { ...p, isAlive: false, role: d.role ?? p.role } : p)));
    const onDayTime = (info: { time: "Day" | "Night"; dayNumber: number; timeLeft: number }) => {
      setTime(info.time);
      setDayNumber(info.dayNumber);
      setTimeLeft(info.timeLeft);
    };

    socket.on("receiveMessage", appendMsg);
    socket.on("receive-chat-message", appendMsg);
    socket.on("receive-whisper-message", appendMsg);
    socket.on("blockMessages", () => setCanTalk(false));
    socket.on("disable-voting", () => setCanVote(false));
    socket.on("receive-new-player", onNewPlayer);
    socket.on("remove-player", onRemovePlayer);
    socket.on("receive-player-list", onPlayerList);
    socket.on("assign-player-role", onAssignRole);
    socket.on("update-player-role", onUpdateRole);
    socket.on("update-faction-role", onFactionRole);
    socket.on("update-day-time", onDayTime);
    socket.on("update-player-visit", () => undefined);

    const autoJoin = setTimeout(() => performJoin(joinCtx), 0);

    return () => {
      clearTimeout(autoJoin);
      socket.off("receiveMessage", appendMsg);
      socket.off("receive-chat-message", appendMsg);
      socket.off("receive-whisper-message", appendMsg);
      socket.off("blockMessages");
      socket.off("disable-voting");
      socket.off("receive-new-player", onNewPlayer);
      socket.off("remove-player", onRemovePlayer);
      socket.off("receive-player-list", onPlayerList);
      socket.off("assign-player-role", onAssignRole);
      socket.off("update-player-role", onUpdateRole);
      socket.off("update-faction-role", onFactionRole);
      socket.off("update-day-time", onDayTime);
      socket.off("update-player-visit");
      socket.disconnect();
    };
  }, [socket]); // socket is stable (lazy useState initializer, never changes)

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((cur) => (cur > 0 ? cur - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const joinGame = () => {
    if (!socket) return;
    performJoin({
      socket, joiningRef, playerNameRef, msgIdRef,
      setJoinStatus, setJoining, setPlayerName, setCurrentUserRole,
      setVisitCapability, setMessages, setCanTalk, setCanVote,
    });
  };

  const sendMessage = () => {
    if (!socket || !messageDraft.trim()) return;
    socket.emit("messageSentByUser", messageDraft.trim(), time === "Day");
    setMessageDraft("");
  };

  const voteForPlayer = (index: number) => {
    if (!socket || time !== "Day") return;
    socket.emit("handleVote", index, true);
  };

  const visitPlayer = (index: number) => {
    if (!socket) return;
    socket.emit("handleVisit", index, time === "Day");
  };

  const whisperToPlayer = (index: number) => {
    if (!socket || !messageDraft.trim()) return;
    socket.emit("handleWhisper", index, messageDraft.trim(), time === "Day");
    setMessageDraft("");
  };

  return {
    joinStatus, playerName, joining, players, messages, messageDraft,
    time, dayNumber, timeLeft, canTalk, canVote, visitCapability, currentUserRole,
    joinGame, sendMessage, voteForPlayer, visitPlayer, whisperToPlayer, setMessageDraft,
  };
}
