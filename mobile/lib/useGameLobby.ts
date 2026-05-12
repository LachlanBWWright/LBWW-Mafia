import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import type {
  DayTime,
  VisitCapability,
} from "../../shared/game/playerActionRules";
import {
  defaultVisitCapability,
  DayTime as DayTimeEnum,
} from "../../shared/game/playerActionRules";
import {
  ClientEvent,
  JoinRoomResultCode,
  ServerEvent,
  type JoinRoomResult,
} from "../../shared/communication/events";
import type {
  GameSocket,
  SocketBackendType,
} from "../../shared/communication/clientTypes";
import { SocketIoClientAdapter } from "../../shared/communication/socketIoClientAdapter";
import { PartykitClientAdapter } from "../../shared/communication/partykitClientAdapter";
import { createTranslator } from "../../shared/communication/messages";
import { en } from "../../shared/communication/locales/en";
import type { GameMessage } from "../../shared/communication/messages";

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

function resolveBackend(value: string | undefined): SocketBackendType {
  return value === "partykit" ? "partykit" : "socketio";
}

function buildSocket(roomId: string) {
  const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL ?? "";
  if (!socketUrl) {
    return null;
  }

  const backend = resolveBackend(process.env.EXPO_PUBLIC_SOCKET_BACKEND);
  if (backend === "partykit") {
    const wsUrl = socketUrl.replace(/^http(s?)/, "ws$1");
    return new PartykitClientAdapter(`${wsUrl}/party/${roomId}`, false);
  }

  const raw = io(socketUrl, { autoConnect: false });
  return new SocketIoClientAdapter(raw);
}

export type LobbyState = {
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
  currentUserRole?: string;
};

export type LobbyActions = {
  joinGame: () => void;
  sendMessage: () => void;
  voteForPlayer: (index: number) => void;
  visitPlayer: (index: number) => void;
  whisperToPlayer: (index: number) => void;
  setMessageDraft: (value: string) => void;
};

export function useGameLobby(roomId: string): LobbyState & LobbyActions {
  const captchaToken =
    process.env.EXPO_PUBLIC_CAPTCHA_TOKEN ??
    (process.env.NODE_ENV === "development" ? "dev-bypass-token" : "");

  const [socket] = useState<GameSocket | null>(() => buildSocket(roomId));
  const [joinStatus, setJoinStatus] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [joining, setJoining] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [time, setTime] = useState<DayTime>(DayTimeEnum.Day);
  const [dayNumber, setDayNumber] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [canTalk, setCanTalk] = useState(true);
  const [canVote, setCanVote] = useState(true);
  const [visitCapability, setVisitCapability] = useState<VisitCapability>(
    defaultVisitCapability,
  );
  const [currentUserRole, setCurrentUserRole] = useState<string | undefined>();

  const msgIdRef = useRef(0);
  const joiningRef = useRef(false);
  const socketRef = useRef<GameSocket | null>(socket);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    if (!socket) {
      setJoinStatus("Socket server URL is not configured.");
      return;
    }

    const appendMsg = (text: string) => {
      msgIdRef.current += 1;
      setMessages((current) => [...current, { id: msgIdRef.current, text }]);
    };

    const onPlayerList = (list: Player[]) => setPlayers(list);
    const onNewPlayer = (player: Player) =>
      setPlayers((current) =>
        current.some((entry) => entry.name === player.name)
          ? current
          : [...current, player],
      );
    const onRemovePlayer = (player: Player) =>
      setPlayers((current) =>
        current.filter((entry) => entry.name !== player.name),
      );
    const onAssignRole = (player: Player & VisitCapability) => {
      setPlayers((current) =>
        current.map((entry) =>
          entry.name === player.name
            ? { ...entry, role: player.role, isUser: true }
            : entry,
        ),
      );
      setCurrentUserRole(player.role);
      setVisitCapability({
        dayVisitSelf: player.dayVisitSelf,
        dayVisitOthers: player.dayVisitOthers,
        dayVisitFaction: player.dayVisitFaction,
        nightVisitSelf: player.nightVisitSelf,
        nightVisitOthers: player.nightVisitOthers,
        nightVisitFaction: player.nightVisitFaction,
      });
    };
    const onUpdateRole = (player: Player) => {
      setPlayers((current) =>
        current.map((entry) =>
          entry.name !== player.name
            ? entry
            : {
                ...entry,
                isAlive: false,
                role: player.role ?? entry.role,
              },
        ),
      );
    };
    const onDayTime = (info: {
      time: DayTime;
      dayNumber: number;
      timeLeft: number;
    }) => {
      setTime(info.time);
      setDayNumber(info.dayNumber);
      setTimeLeft(info.timeLeft);
    };
    const t = createTranslator(en);
    const onGameMessage = (msg: GameMessage) => appendMsg(t(msg));

    socket.on(ServerEvent.ReceiveMessage, onGameMessage);
    socket.on(ServerEvent.ReceiveChatMessage, appendMsg);
    socket.on(ServerEvent.ReceiveWhisperMessage, appendMsg);
    socket.on(ServerEvent.BlockMessages, () => setCanTalk(false));
    socket.on(ServerEvent.DisableVoting, () => setCanVote(false));
    socket.on(ServerEvent.ReceivePlayerList, onPlayerList);
    socket.on(ServerEvent.ReceiveNewPlayer, onNewPlayer);
    socket.on(ServerEvent.RemovePlayer, onRemovePlayer);
    socket.on(ServerEvent.AssignPlayerRole, onAssignRole);
    socket.on(ServerEvent.UpdatePlayerRole, onUpdateRole);
    socket.on(ServerEvent.UpdateDayTime, onDayTime);

    const timer = setTimeout(() => joinGame(), 0);

    return () => {
      clearTimeout(timer);
      socket.off(ServerEvent.ReceiveMessage, onGameMessage);
      socket.off(ServerEvent.ReceiveChatMessage, appendMsg);
      socket.off(ServerEvent.ReceiveWhisperMessage, appendMsg);
      socket.off(ServerEvent.BlockMessages);
      socket.off(ServerEvent.DisableVoting);
      socket.off(ServerEvent.ReceivePlayerList, onPlayerList);
      socket.off(ServerEvent.ReceiveNewPlayer, onNewPlayer);
      socket.off(ServerEvent.RemovePlayer, onRemovePlayer);
      socket.off(ServerEvent.AssignPlayerRole, onAssignRole);
      socket.off(ServerEvent.UpdatePlayerRole, onUpdateRole);
      socket.off(ServerEvent.UpdateDayTime, onDayTime);
      socket.disconnect();
    };
  }, [socket]);

  useEffect(() => {
    if (timeLeft <= 0) {
      return;
    }
    const interval = setInterval(() => {
      setTimeLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const joinGame = () => {
    if (!socketRef.current || joiningRef.current) {
      return;
    }
    if (!captchaToken) {
      setJoinStatus("Captcha token is not configured.");
      return;
    }

    joiningRef.current = true;
    setJoining(true);
    setJoinStatus("Joining game room...");

    const timeout = setTimeout(() => {
      setJoinStatus("Could not connect to the game server.");
      joiningRef.current = false;
      setJoining(false);
    }, 7000);

    socketRef.current.connect(() => {
      socketRef.current?.emit(
        ClientEvent.PlayerJoinRoom,
        captchaToken,
        (result: JoinRoomResult) => {
          clearTimeout(timeout);
          if (result.status === "joined") {
            setPlayerName(result.username);
            setCurrentUserRole(undefined);
            setVisitCapability(defaultVisitCapability);
            setJoinStatus("");
            setMessages([]);
            msgIdRef.current = 0;
            setCanTalk(true);
            setCanVote(true);
          } else {
            if (result.code === JoinRoomResultCode.RoomFull) {
              setJoinStatus("Room is full. Please try again.");
            } else if (result.code === JoinRoomResultCode.CaptchaFailed) {
              setJoinStatus("Failed captcha verification.");
            } else {
              setJoinStatus("Unable to join room.");
            }
          }

          joiningRef.current = false;
          setJoining(false);
        },
      );
    });
  };

  const sendMessage = () => {
    if (!socketRef.current || !messageDraft.trim()) {
      return;
    }
    socketRef.current.emit(
      ClientEvent.MessageSentByUser,
      messageDraft.trim(),
      time,
    );
    setMessageDraft("");
  };

  const voteForPlayer = (index: number) => {
    if (!socketRef.current || time !== DayTimeEnum.Day) {
      return;
    }
    socketRef.current.emit(ClientEvent.HandleVote, index, DayTimeEnum.Day);
  };

  const visitPlayer = (index: number) => {
    if (!socketRef.current) {
      return;
    }
    socketRef.current.emit(
      ClientEvent.HandleVisit,
      index,
      time,
    );
  };

  const whisperToPlayer = (index: number) => {
    if (!socketRef.current || !messageDraft.trim()) {
      return;
    }
    socketRef.current.emit(
      ClientEvent.HandleWhisper,
      index,
      messageDraft.trim(),
      time,
    );
    setMessageDraft("");
  };

  return {
    joinStatus,
    playerName,
    joining,
    players,
    messages,
    messageDraft,
    time,
    dayNumber,
    timeLeft,
    canTalk,
    canVote,
    visitCapability,
    currentUserRole,
    joinGame,
    sendMessage,
    voteForPlayer,
    visitPlayer,
    whisperToPlayer,
    setMessageDraft,
  };
}
