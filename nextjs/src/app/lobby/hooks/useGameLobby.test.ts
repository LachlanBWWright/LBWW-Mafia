import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useGameLobby } from "./useGameLobby";

const { sharedLobby, createSocket, socketIo } = vi.hoisted(() => ({
  sharedLobby: vi.fn((_socket: unknown, ..._args: unknown[]) => ({
    state: {},
    actions: {},
  })),
  createSocket: vi.fn(),
  socketIo: vi.fn(),
}));

vi.mock("@mernmafia/shared/game/useGameLobby", () => ({
  createUseSharedGameLobby: () => sharedLobby,
}));
vi.mock("@mernmafia/shared/communication/createGameSocket", () => ({
  createGameSocket: createSocket,
}));
vi.mock("socket.io-client", () => ({ io: socketIo }));

function Lobby({ practice = false }: { practice?: boolean }) {
  useGameLobby("room", undefined, practice);
  return createElement("div", null, "Lobby");
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("lobby render purity", () => {
  it("does not read or write browser storage or construct network transports during render", () => {
    vi.stubEnv("NEXT_PUBLIC_SOCKET_URL", "https://game.example.test");
    vi.stubEnv("NEXT_PUBLIC_SOCKET_BACKEND", "socketio");
    const getItem = vi.fn();
    const setItem = vi.fn();
    vi.stubGlobal("window", { sessionStorage: { getItem, setItem } });
    renderToString(createElement(Lobby));
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(createSocket).not.toHaveBeenCalled();
    expect(socketIo).not.toHaveBeenCalled();
    expect(sharedLobby.mock.calls[0]?.[0]).toBeNull();
  });

  it("makes practice available on the initial render without browser globals or persistence", () => {
    renderToString(createElement(Lobby, { practice: true }));
    const socket = sharedLobby.mock.calls[0]?.[0];
    expect(socket).toBeDefined();
    expect(socket).not.toBeNull();
    expect(createSocket).not.toHaveBeenCalled();
    expect(socketIo).not.toHaveBeenCalled();
  });
});
