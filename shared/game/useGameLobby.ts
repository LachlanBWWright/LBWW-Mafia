import { PracticeSocket } from "./practiceSocket";
import type * as React from "react";
import type { GameSocket } from "../communication/clientTypes";
import {
  ClientEvent,
  DayTime,
  JoinRoomResultCode,
  ServerEvent,
} from "../communication/events";
import { createTranslator } from "../communication/messages";
import { en } from "../communication/locales/en";
import {
  initialLobbyState,
  lobbyReducer,
  type LobbyAction,
} from "./lobbyState";
export type { LobbyState } from "./lobbyState";
export type LobbyActions = {
  joinGame: () => void;
  sendMessage: () => void;
  voteForPlayer: (index: number | null) => void;
  cancelVisit: () => void;
  advancePractice: () => void;
  readyForRematch: () => void;
  dismissRecovery: () => void;
  visitPlayer: (index: number) => void;
  whisperToPlayer: (index: number) => void;
  setMessageDraft: (value: string) => void;
};

/** Both clients use this reducer and event lifecycle; wrappers supply transport and credentials. */
export function createUseSharedGameLobby(
  hooks: Pick<
    typeof React,
    "useCallback" | "useEffect" | "useReducer" | "useRef"
  >,
) {
  const { useCallback, useEffect, useReducer, useRef } = hooks;
  return function useSharedGameLobby(
    socket: GameSocket | null,
    getTicket: () => Promise<string | undefined>,
    onRoomFull?: () => void,
    joinMode: "player" | "spectator" = "player",
  ) {
    const [state, dispatch] = useReducer(lobbyReducer, initialLobbyState);
    const joining = useRef(false);
    const joinAttempt = useRef(0);
    const mounted = useRef(false);
    const joinTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
      undefined,
    );
    const joinGame = useCallback(async () => {
      if (!socket || joining.current) return;
      joining.current = true;
      const attempt = ++joinAttempt.current;
      dispatch({
        type: "patch",
        value: { joining: true, joinStatus: "Joining game room..." },
      });
      clearTimeout(joinTimeout.current);
      joinTimeout.current = setTimeout(() => {
        if (!mounted.current || joinAttempt.current !== attempt) return;
        joinAttempt.current += 1;
        joining.current = false;
        dispatch({
          type: "patch",
          value: {
            joining: false,
            joinStatus: "Could not connect to the game server.",
          },
        });
      }, 7000);
      const ticket = await getTicket().catch(() => undefined);
      if (!mounted.current || joinAttempt.current !== attempt) return;
      socket.connect(
        () =>
          mounted.current &&
          joinAttempt.current === attempt &&
          socket.emit(
            joinMode === "spectator"
              ? ClientEvent.SpectatorJoinRoom
              : ClientEvent.PlayerJoinRoom,
            "", // Reserved legacy CAPTCHA argument; verification is disabled.
            ticket ?? "",
            (result) => {
              if (!mounted.current || joinAttempt.current !== attempt) return;
              clearTimeout(joinTimeout.current);
              joining.current = false;
              if (result.status === "joined")
                dispatch({
                  type: "patch",
                  value: {
                    joining: false,
                    playerName: result.username,
                    joinStatus: "",
                  },
                });
              else {
                dispatch({
                  type: "patch",
                  value: {
                    joining: false,
                    joinStatus:
                      result.code === JoinRoomResultCode.RoomFull
                        ? "Room is full. Please try again."
                        : "Unable to join room.",
                  },
                });
                if (result.code === JoinRoomResultCode.RoomFull) onRoomFull?.();
              }
            },
          ),
      );
    }, [socket, getTicket, onRoomFull, joinMode]);
    useEffect(() => {
      mounted.current = true;
      joining.current = false;
      dispatch({
        type: "patch",
        value: {
          ...initialLobbyState,
          joinStatus: socket ? "" : "Could not connect to the game server.",
        },
      });
      if (!socket)
        return () => {
          mounted.current = false;
        };
      const translate = createTranslator(en);
      const subscriptions: (() => void)[] = [];
      const bind = <
        K extends keyof import("../communication/events").ServerToClientEvents,
      >(
        event: K,
        handler: import("../communication/events").ServerToClientEvents[K],
      ) => {
        socket.on(event, handler);
        subscriptions.push(() => socket.off(event, handler));
      };
      const apply = (action: LobbyAction) => dispatch(action);
      bind(ServerEvent.GameSnapshot, (value) =>
        apply({ type: "snapshot", value }),
      );
      bind(ServerEvent.ReceiveMessage, (value) => {
        const text = translate(value);
        apply({
          type: "message",
          text,
          kind: value.key.includes("result") ? "role" : "system",
        });
        if (
          /cannot(?!.*(?:speak|whisper))|invalid(?!.*whisper)|no_day_action|no_night_action|no_night_vote|action_not_confirmed|action_rejected|action_stale|no_sessions|no_alerts|voting_disabled/.test(
            value.key,
          )
        )
          apply({ type: "feedback", feedback: text, outcome: "rejected" });
        if (value.key === "you_were_roleblocked")
          apply({ type: "feedback", feedback: text, outcome: "blocked" });
      });
      bind(ServerEvent.ReceiveChatMessage, (text) =>
        apply({
          type: "message",
          text,
          kind: "chat",
          sender: text.split(": ")[0],
        }),
      );
      bind(ServerEvent.ReceiveSpectatorMessage, (text) =>
        apply({
          type: "message",
          text,
          kind: "spectator",
          sender: text.split(": ")[0],
        }),
      );
      bind(ServerEvent.ReceiveWhisperMessage, (text) =>
        apply({ type: "message", text, kind: "whisper" }),
      );
      bind(ServerEvent.ReceiveRole, (text) =>
        apply({ type: "message", text, kind: "role" }),
      );
      bind(ServerEvent.BlockMessages, () =>
        apply({ type: "patch", value: { canTalk: false } }),
      );
      bind(ServerEvent.DisableVoting, () =>
        apply({ type: "patch", value: { canVote: false } }),
      );
      bind(ServerEvent.ReceivePlayerList, (players) =>
        apply({ type: "patch", value: { players } }),
      );
      bind(ServerEvent.ReceiveNewPlayer, (player) =>
        apply({ type: "add", player }),
      );
      bind(ServerEvent.RemovePlayer, ({ name }) =>
        apply({ type: "remove", name }),
      );
      bind(ServerEvent.AssignPlayerRole, (player) =>
        apply({ type: "assign", player }),
      );
      bind(ServerEvent.UpdatePlayerRole, (player) =>
        apply({ type: "role", player, dead: true }),
      );
      bind(ServerEvent.UpdateFactionRole, (player) =>
        apply({ type: "role", player }),
      );
      bind(ServerEvent.UpdateDayTime, (value) =>
        apply({ type: "phase", value }),
      );
      const autoJoin = setTimeout(() => void joinGame(), 0);
      const tick = setInterval(() => {
        apply({ type: "tick" });
        // Transport reconnection is automatic; expose its current state to both clients.
        if (!socket.connected) apply({ type: "connection", connected: false });
      }, 1000);
      return () => {
        mounted.current = false;
        joinAttempt.current += 1;
        clearTimeout(autoJoin);
        clearTimeout(joinTimeout.current);
        clearInterval(tick);
        subscriptions.forEach((unsubscribe) => unsubscribe());
        socket.disconnect();
      };
    }, [socket, joinGame]);
    const disconnected = () => {
      if (socket?.connected) return false;
      dispatch({
        type: "patch",
        value: {
          action: {
            ...state.action,
            feedback:
              "Connection lost. Your action was not sent. Try again after reconnecting.",
            outcome: "rejected",
          },
        },
      });
      return true;
    };
    const sendMessage = () => {
      if (
        disconnected() ||
        !socket ||
        !state.canTalk ||
        !state.messageDraft.trim()
      )
        return;
      socket.emit(
        ClientEvent.MessageSentByUser,
        state.messageDraft.trim(),
        state.time,
      );
      dispatch({ type: "patch", value: { messageDraft: "" } });
    };
    return {
      ...state,
      joinGame: () => void joinGame(),
      sendMessage,
      advancePractice: () => {
        if (socket instanceof PracticeSocket) socket.advance();
      },
      dismissRecovery: () =>
        dispatch({ type: "patch", value: { recoveryNotice: "" } }),
      readyForRematch: () => {
        if (state.participation === "spectator") return;
        if (!disconnected() && state.ended)
          socket?.emit(ClientEvent.ReadyForRematch);
      },
      cancelVisit: () => {
        if (
          state.participation === "spectator" ||
          state.participation === "eliminated"
        )
          return;
        if (!disconnected() && !state.ended)
          socket?.emit(ClientEvent.HandleVisit, null, state.time);
      },
      voteForPlayer: (index: number | null) => {
        if (
          state.participation === "spectator" ||
          state.participation === "eliminated"
        )
          return;
        if (
          !disconnected() &&
          socket &&
          state.started &&
          !state.ended &&
          state.canVote &&
          state.action.vote === undefined &&
          (state.time === DayTime.Day ||
            (state.visitCapability &&
              "nightVote" in state.visitCapability &&
              state.visitCapability.nightVote))
        )
          socket.emit(ClientEvent.HandleVote, index, state.time);
      },
      visitPlayer: (index: number) => {
        if (
          state.participation === "spectator" ||
          state.participation === "eliminated"
        )
          return;
        if (!disconnected() && socket && state.started && !state.ended)
          socket.emit(ClientEvent.HandleVisit, index, state.time);
      },
      whisperToPlayer: (index: number) => {
        if (
          state.participation === "spectator" ||
          state.participation === "eliminated"
        )
          return;
        if (
          disconnected() ||
          !socket ||
          !state.canTalk ||
          !state.messageDraft.trim()
        )
          return;
        socket.emit(
          ClientEvent.HandleWhisper,
          index,
          state.messageDraft.trim(),
          state.time,
        );
        dispatch({ type: "patch", value: { messageDraft: "" } });
      },
      setMessageDraft: (messageDraft: string) =>
        dispatch({ type: "patch", value: { messageDraft } }),
    };
  };
}
