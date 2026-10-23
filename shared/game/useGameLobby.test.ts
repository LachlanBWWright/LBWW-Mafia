import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import type { GameSocket } from "../communication/clientTypes";
import { ClientEvent } from "../communication/events";
import { initialLobbyState, type LobbyState } from "./lobbyState";
import { createUseSharedGameLobby } from "./useGameLobby";

function harness(participation: LobbyState["participation"], ended = false) {
  const dispatch = vi.fn();
  const state: LobbyState = {
    ...initialLobbyState,
    participation,
    connected: true,
    started: true,
    ended,
    messageDraft: "Keep this draft",
    canTalk: true,
    canVote: true,
  };
  const hooks = {
    useReducer: (() => [state, dispatch]) as unknown as typeof React.useReducer,
    useRef: ((current: unknown) => ({ current })) as typeof React.useRef,
    useCallback: ((callback: unknown) => callback) as typeof React.useCallback,
    useEffect: (() => undefined) as typeof React.useEffect,
  };
  const socket = { connected: true, emit: vi.fn() } as unknown as GameSocket;
  const actions = createUseSharedGameLobby(hooks)(
    socket,
    async () => undefined,
  );
  return { actions, socket, dispatch };
}

describe("observer action boundaries", () => {
  it.each(["spectator", "eliminated"] as const)(
    "retains %s chat drafts when private gameplay actions are attempted",
    (participation) => {
      const { actions, socket, dispatch } = harness(participation);
      actions.whisperToPlayer(0);
      actions.visitPlayer(0);
      actions.cancelVisit();
      actions.voteForPlayer(0);
      expect(socket.emit).not.toHaveBeenCalled();
      expect(dispatch).not.toHaveBeenCalled();
      expect(actions.messageDraft).toBe("Keep this draft");
      actions.sendMessage();
      expect(socket.emit).toHaveBeenCalledWith(
        ClientEvent.MessageSentByUser,
        "Keep this draft",
        actions.time,
      );
    },
  );
  it("keeps observers out of rematch readiness while allowing eliminated players to rejoin their group", () => {
    const observer = harness("spectator", true);
    observer.actions.readyForRematch();
    expect(observer.socket.emit).not.toHaveBeenCalled();
    const eliminated = harness("eliminated", true);
    eliminated.actions.readyForRematch();
    expect(eliminated.socket.emit).toHaveBeenCalledWith(
      ClientEvent.ReadyForRematch,
    );
  });
});

describe("joins without CAPTCHA", () => {
  it.each(["player", "spectator"] as const)(
    "joins as a %s without a CAPTCHA token and preserves the identity ticket",
    async (joinMode) => {
      vi.useFakeTimers();
      const effects: React.EffectCallback[] = [];
      const dispatch = vi.fn();
      const hooks = {
        useReducer: (() => [
          initialLobbyState,
          dispatch,
        ]) as unknown as typeof React.useReducer,
        useRef: ((current: unknown) => ({ current })) as typeof React.useRef,
        useCallback: ((callback: unknown) =>
          callback) as typeof React.useCallback,
        useEffect: ((effect: React.EffectCallback) => {
          effects.push(effect);
        }) as typeof React.useEffect,
      };
      const emit = vi.fn((_event, _legacyToken, _ticket, callback) => {
        callback({ status: "joined", username: "Alex" });
      });
      const socket = {
        connected: true,
        connect: (ready: () => void) => ready(),
        disconnect: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        emit,
      } as unknown as GameSocket;
      const getTicket = vi.fn(async () => "identity-ticket");
      createUseSharedGameLobby(hooks)(socket, getTicket, undefined, joinMode);
      const cleanups = effects.map((effect) => effect());
      try {
        await vi.advanceTimersByTimeAsync(0);
        expect(emit).toHaveBeenCalledWith(
          joinMode === "spectator"
            ? ClientEvent.SpectatorJoinRoom
            : ClientEvent.PlayerJoinRoom,
          "",
          "identity-ticket",
          expect.any(Function),
        );
        expect(dispatch).toHaveBeenCalledWith({
          type: "patch",
          value: { joining: false, playerName: "Alex", joinStatus: "" },
        });
      } finally {
        cleanups.forEach((cleanup) => {
          if (typeof cleanup === "function") cleanup();
        });
        vi.useRealTimers();
      }
    },
  );
});

function lifecycleHarness(
  getTicket = vi.fn(async (): Promise<string | undefined> => "ticket"),
) {
  const effects: React.EffectCallback[] = [];
  const dependencies: React.DependencyList[] = [];
  const dispatch = vi.fn();
  const hooks = {
    useReducer: (() => [
      initialLobbyState,
      dispatch,
    ]) as unknown as typeof React.useReducer,
    useRef: ((current: unknown) => ({ current })) as typeof React.useRef,
    useCallback: ((callback: unknown) => callback) as typeof React.useCallback,
    useEffect: ((effect: React.EffectCallback, deps: React.DependencyList) => {
      effects.push(effect);
      dependencies.push(deps);
    }) as typeof React.useEffect,
  };
  const socket = {
    connected: true,
    connect: vi.fn((ready: () => void) => ready()),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };
  const actions = createUseSharedGameLobby(hooks)(
    socket as unknown as GameSocket,
    getTicket,
  );
  const setup = effects[0]!;
  return { setup, socket, dispatch, dependencies, actions };
}

function cleanupEffect(cleanup: ReturnType<React.EffectCallback>) {
  if (typeof cleanup === "function") cleanup();
}

describe("shared lobby external lifecycle", () => {
  it("removes each exact subscription and all timers on cleanup", async () => {
    vi.useFakeTimers();
    const { setup, socket, dispatch } = lifecycleHarness();
    const cleanup = setup();
    try {
      expect(socket.on.mock.calls.length).toBeGreaterThan(0);
      await vi.advanceTimersByTimeAsync(1000);
      expect(dispatch).toHaveBeenCalledWith({ type: "tick" });
      cleanupEffect(cleanup);
      expect(socket.off.mock.calls).toEqual(socket.on.mock.calls);
      expect(socket.disconnect).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
      dispatch.mockClear();
      await vi.advanceTimersByTimeAsync(10000);
      expect(dispatch).not.toHaveBeenCalled();
    } finally {
      cleanupEffect(cleanup);
      vi.useRealTimers();
    }
  });

  it("can replay effect setup and cleanup without duplicate live timers in StrictMode", async () => {
    vi.useFakeTimers();
    const { setup, socket, dispatch } = lifecycleHarness();
    const firstCleanup = setup();
    cleanupEffect(firstCleanup);
    const secondCleanup = setup();
    try {
      await vi.advanceTimersByTimeAsync(1000);
      expect(socket.emit).toHaveBeenCalledTimes(1);
      expect(
        dispatch.mock.calls.filter(([action]) => action.type === "tick"),
      ).toHaveLength(1);
      expect(socket.on.mock.calls).toHaveLength(
        socket.off.mock.calls.length * 2,
      );
      cleanupEffect(secondCleanup);
      expect(socket.off.mock.calls).toHaveLength(socket.on.mock.calls.length);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      cleanupEffect(secondCleanup);
      vi.useRealTimers();
    }
  });

  it("ignores a ticket resolved after unmount", async () => {
    vi.useFakeTimers();
    let resolveTicket!: (ticket: string) => void;
    const ticket = new Promise<string>((resolve) => {
      resolveTicket = resolve;
    });
    const { setup, socket, dispatch } = lifecycleHarness(vi.fn(() => ticket));
    const cleanup = setup();
    try {
      await vi.advanceTimersByTimeAsync(0);
      cleanupEffect(cleanup);
      dispatch.mockClear();
      resolveTicket("late-ticket");
      await Promise.resolve();
      await Promise.resolve();
      expect(socket.connect).not.toHaveBeenCalled();
      expect(socket.emit).not.toHaveBeenCalled();
      expect(dispatch).not.toHaveBeenCalled();
    } finally {
      cleanupEffect(cleanup);
      vi.useRealTimers();
    }
  });

  it("reports a disconnected transport while its interval remains active", async () => {
    vi.useFakeTimers();
    const { setup, socket, dispatch } = lifecycleHarness();
    const cleanup = setup();
    try {
      await vi.advanceTimersByTimeAsync(0);
      dispatch.mockClear();
      socket.connected = false;
      await vi.advanceTimersByTimeAsync(1000);
      expect(dispatch).toHaveBeenCalledWith({
        type: "connection",
        connected: false,
      });
      expect(dispatch).toHaveBeenCalledWith({ type: "tick" });
      socket.connected = true;
      dispatch.mockClear();
      await vi.advanceTimersByTimeAsync(1000);
      expect(dispatch).not.toHaveBeenCalledWith({
        type: "connection",
        connected: false,
      });
    } finally {
      cleanupEffect(cleanup);
      vi.useRealTimers();
    }
  });
});

describe("join acknowledgement lifecycle", () => {
  it("ignores acknowledgements arriving after cleanup", async () => {
    vi.useFakeTimers();
    const { setup, socket, dispatch } = lifecycleHarness();
    const cleanup = setup();
    try {
      await vi.advanceTimersByTimeAsync(0);
      const args = socket.emit.mock.calls[0] as unknown as [
        string,
        string,
        string,
        (result: { status: "joined"; username: string }) => void,
      ];
      expect(args).toBeDefined();
      cleanupEffect(cleanup);
      dispatch.mockClear();
      args[3]({ status: "joined", username: "Late" });
      expect(dispatch).not.toHaveBeenCalled();
    } finally {
      cleanupEffect(cleanup);
      vi.useRealTimers();
    }
  });

  it("reports join timeout once and ignores an acknowledgement from that expired attempt", async () => {
    vi.useFakeTimers();
    const { setup, socket, dispatch } = lifecycleHarness();
    const cleanup = setup();
    try {
      await vi.advanceTimersByTimeAsync(0);
      const args = socket.emit.mock.calls[0] as unknown as [
        string,
        string,
        string,
        (result: { status: "joined"; username: string }) => void,
      ];
      await vi.advanceTimersByTimeAsync(7000);
      expect(dispatch).toHaveBeenCalledWith({
        type: "patch",
        value: {
          joining: false,
          joinStatus: "Could not connect to the game server.",
        },
      });
      dispatch.mockClear();
      args[3]({ status: "joined", username: "Too late" });
      expect(dispatch).not.toHaveBeenCalled();
    } finally {
      cleanupEffect(cleanup);
      vi.useRealTimers();
    }
  });
});
