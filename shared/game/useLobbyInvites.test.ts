import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUseLobbyInvites } from "./useLobbyInvites";
import { fixtureUsers } from "../testing/fixtures";

function fixture(owner: boolean) {
  const friends = fixtureUsers;
  const sent = {
    id: 1,
    senderId: "host",
    senderName: "Host",
    recipientId: "user-nadia",
    roomId: "room",
    status: "pending",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 100000),
  };
  return {
    social: { friends: { query: vi.fn().mockResolvedValue(friends) } },
    features: {
      hostedLobbies: {
        query: vi.fn().mockResolvedValue(owner ? [{ roomId: "room" }] : []),
      },
      sentInvitations: { query: vi.fn().mockResolvedValue([]) },
      invite: { mutate: vi.fn().mockResolvedValue(sent) },
    },
  };
}
function harness(client: ReturnType<typeof fixture>) {
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
  const useInvites = createUseLobbyInvites(hooks);
  const render = () => {
    position = 0;
    return useInvites(client, "room");
  };
  render();
  const cleanup = mount?.();
  return { render, cleanup };
}
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
afterEach(() => vi.useRealTimers());
describe("lobby invitations", () => {
  it("shows friends and sends a host invitation to the current room", async () => {
    vi.useFakeTimers();
    const client = fixture(true);
    const view = harness(client);
    await flush();
    expect(view.render().isHost).toBe(true);
    expect(view.render().friends.map((friend) => friend.id)).toEqual([
      "user-nadia",
    ]);
    await view.render().invite("user-nadia");
    expect(client.features.invite.mutate).toHaveBeenCalledWith({
      roomId: "room",
      recipientId: "user-nadia",
    });
    view.cleanup?.();
  });
  it("does not fetch invitation details for a non-host", async () => {
    vi.useFakeTimers();
    const client = fixture(false);
    const view = harness(client);
    await flush();
    expect(view.render().isHost).toBe(false);
    expect(client.features.sentInvitations.query).not.toHaveBeenCalled();
    view.cleanup?.();
  });
});
