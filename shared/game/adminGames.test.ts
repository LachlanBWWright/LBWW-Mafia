import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { createUseAdminGames } from "../admin/useAdminGames";
import { adminGamesFixture } from "../testing/adminGamesFixtures";
import type { AdminGamePage } from "../admin/games";
function harness(load: Parameters<ReturnType<typeof createUseAdminGames>>[0]) {
  const values: unknown[] = [];
  let index = 0;
  let mount: (() => void | (() => void)) | undefined;
  const hooks = {
    useState: ((initial: unknown) => {
      const slot = index++;
      if (!(slot in values)) values[slot] = initial;
      return [
        values[slot],
        (value: unknown) => {
          values[slot] = value;
        },
      ];
    }) as typeof React.useState,
    useRef: ((initial: unknown) => {
      const slot = index++;
      if (!(slot in values)) values[slot] = { current: initial };
      return values[slot];
    }) as typeof React.useRef,
    useCallback: ((callback: unknown) => callback) as typeof React.useCallback,
    useEffect: ((effect: () => void | (() => void)) => {
      mount ??= effect;
    }) as typeof React.useEffect,
  };
  const useGames = createUseAdminGames(hooks);
  const render = () => {
    index = 0;
    return useGames(load);
  };
  render();
  const cleanup = mount?.();
  return { render, cleanup };
}
describe("admin game loading", () => {
  it("aborts replaced requests and ignores late responses", async () => {
    let finish: ((page: AdminGamePage) => void) | undefined;
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<AdminGamePage>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValueOnce(adminGamesFixture);
    const view = harness(load);
    const firstSignal = load.mock.calls[0]![1] as AbortSignal;
    await view.render().refresh();
    expect(firstSignal.aborted).toBe(true);
    finish?.({ ...adminGamesFixture, games: [] });
    await Promise.resolve();
    expect(view.render().page).toEqual(adminGamesFixture);
    view.cleanup?.();
    expect((load.mock.calls[1]![1] as AbortSignal).aborted).toBe(true);
  });
  it("clears stale data on failure and can retry", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(adminGamesFixture)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(adminGamesFixture);
    const view = harness(load);
    await Promise.resolve();
    await view.render().refresh();
    expect(view.render().page).toBe(null);
    expect(view.render().error).toBe("Unable to load games. Try again.");
    await view.render().refresh();
    expect(view.render().error).toBe("");
    expect(view.render().page).toEqual(adminGamesFixture);
    view.cleanup?.();
  });
});
