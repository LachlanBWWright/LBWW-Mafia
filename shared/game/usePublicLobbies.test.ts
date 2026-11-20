import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUsePublicLobbies } from "./usePublicLobbies";
import { requestPublicLobbyPage } from "./publicLobbies";
vi.mock("./publicLobbies", () => ({ requestPublicLobbyPage: vi.fn() }));
function harness() {
  const values: unknown[] = [];
  let position = 0;
  let mount: (() => void | (() => void)) | undefined;
  const hooks = {
    useState: ((initial: unknown) => {
      const i = position++;
      if (!(i in values)) values[i] = initial;
      return [
        values[i],
        (next: unknown) => {
          values[i] =
            typeof next === "function"
              ? (next as (previous: unknown) => unknown)(values[i])
              : next;
        },
      ];
    }) as typeof React.useState,
    useRef: ((initial: unknown) => {
      const i = position++;
      if (!(i in values)) values[i] = { current: initial };
      return values[i];
    }) as typeof React.useRef,
    useCallback: ((fn: unknown) => fn) as typeof React.useCallback,
    useEffect: ((fn: () => void | (() => void)) => {
      mount ??= fn;
    }) as typeof React.useEffect,
  };
  const useDirectory = createUsePublicLobbies(hooks);
  const render = () => {
    position = 0;
    return useDirectory();
  };
  render();
  const cleanup = mount?.();
  return { render, cleanup };
}
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
describe("public lobby directory", () => {
  it("loads subsequent pages and refreshes all loaded room states", async () => {
    vi.useFakeTimers();
    const one = {
      roomId: "one",
      name: "One",
      players: 1,
      capacity: 8,
      status: "waiting" as const,
    };
    const two = {
      roomId: "two",
      name: "Two",
      players: 2,
      capacity: 8,
      status: "waiting" as const,
    };
    const query = vi.mocked(requestPublicLobbyPage);
    query
      .mockResolvedValueOnce({ lobbies: [one], nextOffset: 50 })
      .mockResolvedValueOnce({ lobbies: [two], nextOffset: null })
      .mockResolvedValueOnce({
        lobbies: [{ ...one, players: 3 }],
        nextOffset: 50,
      })
      .mockResolvedValueOnce({ lobbies: [two], nextOffset: null });
    const view = harness();
    for (let i = 0; i < 4; i++) await Promise.resolve();
    expect(view.render().next).toBe(50);
    await view.render().load(50);
    expect(view.render().lobbies.map((room) => room.roomId)).toEqual([
      "one",
      "two",
    ]);
    await vi.advanceTimersByTimeAsync(15000);
    expect(view.render().lobbies[0]?.players).toBe(3);
    expect(view.render().lobbies).toHaveLength(2);
    view.cleanup?.();
  });
});
