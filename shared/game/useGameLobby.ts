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
  voteForPlayer: (index: number) => void;
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
    captchaToken: string,
    getTicket: () => Promise<string | undefined>,
    onRoomFull?: () => void,
  ) {
    const [state, dispatch] = useReducer(lobbyReducer, initialLobbyState);
    const joining = useRef(false);
    const mounted = useRef(false);
    const joinTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
      undefined,
    );
    const joinGame = useCallback(async () => {
      if (!socket || joining.current) return;
      if (!captchaToken) {
        dispatch({
          type: "patch",
          value: { joinStatus: "Captcha verification is unavailable." },
        });
        return;
      }
      joining.current = true;
      dispatch({
        type: "patch",
        value: { joining: true, joinStatus: "Joining game room..." },
      });
      const ticket = await getTicket().catch(() => undefined);
      if (!mounted.current) return;
      clearTimeout(joinTimeout.current);
      joinTimeout.current = setTimeout(() => {
        joining.current = false;
        dispatch({
          type: "patch",
          value: {
            joining: false,
            joinStatus: "Could not connect to the game server.",
          },
        });
      }, 7000);
      socket.connect(() =>
        socket.emit(
          ClientEvent.PlayerJoinRoom,
          captchaToken,
          ticket ?? "",
          (result) => {
            if (!mounted.current) return;
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
                      : result.code === JoinRoomResultCode.CaptchaFailed
                        ? "Failed captcha verification."
                        : "Unable to join room.",
                },
              });
              if (result.code === JoinRoomResultCode.RoomFull) onRoomFull?.();
            }
          },
        ),
      );
    }, [socket, captchaToken, getTicket, onRoomFull]);
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
      bind(ServerEvent.ReceiveMessage, (value) =>
        apply({ type: "message", text: translate(value) }),
      );
      bind(ServerEvent.ReceiveChatMessage, (text) =>
        apply({ type: "message", text }),
      );
      bind(ServerEvent.ReceiveWhisperMessage, (text) =>
        apply({ type: "message", text }),
      );
      bind(ServerEvent.ReceiveRole, (text) => apply({ type: "message", text }));
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
        apply({ type: "patch", value }),
      );
      const autoJoin = setTimeout(() => void joinGame(), 0);
      const tick = setInterval(() => apply({ type: "tick" }), 1000);
      return () => {
        mounted.current = false;
        clearTimeout(autoJoin);
        clearTimeout(joinTimeout.current);
        clearInterval(tick);
        subscriptions.forEach((unsubscribe) => unsubscribe());
        socket.disconnect();
      };
    }, [socket, joinGame]);
    const sendMessage = () => {
      if (!socket?.connected || !state.canTalk || !state.messageDraft.trim())
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
      voteForPlayer: (index: number) => {
        if (socket?.connected && state.canVote && state.time === DayTime.Day)
          socket.emit(ClientEvent.HandleVote, index, DayTime.Day);
      },
      visitPlayer: (index: number) => {
        if (socket?.connected)
          socket.emit(ClientEvent.HandleVisit, index, state.time);
      },
      whisperToPlayer: (index: number) => {
        if (!socket?.connected || !state.canTalk || !state.messageDraft.trim())
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
