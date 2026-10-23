import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUseLobbyGroup, type LobbyGroupClient } from "./useLobbyGroup";
import { fixtureParty, fixturePartyInvitation } from "../testing/partyFixtures";

function harness(client: LobbyGroupClient) {
  const values: unknown[] = [];
  let position = 0;
  let mount: (() => void | (() => void)) | undefined;
  const hooks = {
    useState: ((initial: unknown) => {
      const slot = position++;
      if (!(slot in values))
        values[slot] =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      return [
        values[slot],
        (next: unknown) => {
          values[slot] =
            typeof next === "function"
              ? (next as (previous: unknown) => unknown)(values[slot])
              : next;
        },
      ];
    }) as typeof React.useState,
    useRef: ((initial: unknown) => {
      const slot = position++;
      if (!(slot in values)) values[slot] = { current: initial };
      return values[slot];
    }) as typeof React.useRef,
    useCallback: ((callback: unknown) => callback) as typeof React.useCallback,
    useEffect: ((callback: () => void | (() => void)) => {
      mount ??= callback;
    }) as typeof React.useEffect,
  };
  const useGroup = createUseLobbyGroup(hooks);
  const render = () => {
    position = 0;
    return useGroup(client);
  };
  render();
  const cleanup = mount?.();
  return { render, cleanup };
}
function clientFixture() {
  return {
    account: {
      profile: { query: vi.fn().mockResolvedValue({ id: "user-mira" }) },
    },
    social: { friends: { query: vi.fn().mockResolvedValue([]) } },
    party: {
      current: { query: vi.fn().mockResolvedValue(fixtureParty) },
      invitations: {
        query: vi.fn().mockResolvedValue([fixturePartyInvitation]),
      },
      create: { mutate: vi.fn().mockResolvedValue(fixtureParty) },
      invite: { mutate: vi.fn().mockResolvedValue(fixturePartyInvitation) },
      respond: { mutate: vi.fn().mockResolvedValue(fixtureParty) },
      leave: { mutate: vi.fn().mockResolvedValue(undefined) },
      kick: { mutate: vi.fn().mockResolvedValue(undefined) },
      transfer: { mutate: vi.fn().mockResolvedValue(undefined) },
      move: { mutate: vi.fn().mockResolvedValue(undefined) },
    },
  } satisfies LobbyGroupClient;
}
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
afterEach(() => vi.useRealTimers());

describe("party lifecycle", () => {
  it("loads membership and invitations and refreshes destination changes", async () => {
    vi.useFakeTimers();
    const client = clientFixture();
    const view = harness(client);
    await flush();
    expect(view.render().party?.roomId).toBe("friday-night");
    expect(view.render().invitations).toHaveLength(1);
    client.party.current.query.mockResolvedValue({
      ...fixtureParty,
      roomId: "next-round",
    });
    await view.render().act({ type: "move", roomId: "next-round" });
    expect(client.party.move.mutate).toHaveBeenCalledWith({
      roomId: "next-round",
    });
    expect(view.render().party?.roomId).toBe("next-round");
    expect(view.render().status).toBe("Party destination updated.");
    view.cleanup?.();
  });
  it("keeps membership visible after a failed mutation and allows retry", async () => {
    vi.useFakeTimers();
    const client = clientFixture();
    const view = harness(client);
    await flush();
    client.party.invite.mutate.mockRejectedValueOnce(
      new Error("This player blocked you."),
    );
    await view.render().act({ type: "invite", recipientId: "blocked-user" });
    expect(view.render().error).toBe("This player blocked you.");
    expect(view.render().party).toEqual(fixtureParty);
    expect(view.render().busy).toBe(false);
    await view.render().act({ type: "invite", recipientId: "friend-user" });
    expect(view.render().error).toBe("");
    expect(view.render().status).toBe("Party invitation sent.");
    view.cleanup?.();
  });
  it("prevents duplicate mutations and stops polling after unmount", async () => {
    vi.useFakeTimers();
    const client = clientFixture();
    let finish: (() => void) | undefined;
    client.party.leave.mutate.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const view = harness(client);
    await flush();
    const pending = view.render().act({ type: "leave" });
    await view.render().act({ type: "leave" });
    expect(client.party.leave.mutate).toHaveBeenCalledTimes(1);
    view.cleanup?.();
    const reads = client.party.current.query.mock.calls.length;
    finish?.();
    await pending;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(client.party.current.query).toHaveBeenCalledTimes(reads);
  });
  it("ignores an older fetch when a newer refresh has completed", async () => {
    vi.useFakeTimers();
    const client = clientFixture();
    let finishOld: ((value: typeof fixtureParty) => void) | undefined;
    client.party.current.query.mockImplementationOnce(
      () =>
        new Promise<typeof fixtureParty>((resolve) => {
          finishOld = resolve;
        }),
    );
    const view = harness(client);
    client.party.current.query.mockResolvedValue({
      ...fixtureParty,
      roomId: "new-room",
    });
    await view.render().refresh();
    finishOld?.(fixtureParty);
    await flush();
    expect(view.render().party?.roomId).toBe("new-room");
    view.cleanup?.();
  });
});
