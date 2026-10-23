import type * as React from "react";
import type { SocialUser } from "../trpc/appRouter";
import type { PartySummary, PartyInvitation } from "../trpc/parties";

export type LobbyGroupClient = {
  account: { profile: { query(): Promise<{ id: string }> } };
  social: { friends: { query(): Promise<SocialUser[]> } };
  party: {
    current: { query(): Promise<PartySummary | null> };
    invitations: { query(): Promise<PartyInvitation[]> };
    create: { mutate(): Promise<unknown> };
    invite: { mutate(input: { recipientId: string }): Promise<unknown> };
    respond: {
      mutate(input: { id: number; accept: boolean }): Promise<unknown>;
    };
    leave: { mutate(): Promise<unknown> };
    kick: { mutate(input: { userId: string }): Promise<unknown> };
    transfer: { mutate(input: { userId: string }): Promise<unknown> };
    move: { mutate(input: { roomId: string }): Promise<unknown> };
  };
};
export type LobbyGroupAction =
  | { type: "create" | "leave" }
  | { type: "invite"; recipientId: string }
  | { type: "respond"; id: number; accept: boolean }
  | { type: "kick" | "transfer"; userId: string }
  | { type: "move"; roomId: string };

export function createUseLobbyGroup(
  hooks: Pick<
    typeof React,
    "useState" | "useCallback" | "useEffect" | "useRef"
  >,
) {
  return function useLobbyGroup(
    client: LobbyGroupClient,
    subscribe?: (refresh: () => void) => () => void,
  ) {
    const [party, setParty] = hooks.useState<PartySummary | null>(null);
    const [invitations, setInvitations] = hooks.useState<PartyInvitation[]>([]);
    const [friends, setFriends] = hooks.useState<SocialUser[]>([]);
    const [userId, setUserId] = hooks.useState("");
    const [loading, setLoading] = hooks.useState(true);
    const [busy, setBusy] = hooks.useState(false);
    const [status, setStatus] = hooks.useState("");
    const [error, setError] = hooks.useState("");
    const mounted = hooks.useRef(false);
    const actionPending = hooks.useRef(false);
    const generation = hooks.useRef(0);
    const refresh = hooks.useCallback(async () => {
      const request = ++generation.current;
      try {
        const [profile, nextParty, nextInvitations, nextFriends] =
          await Promise.all([
            client.account.profile.query(),
            client.party.current.query(),
            client.party.invitations.query(),
            client.social.friends.query(),
          ]);
        if (!mounted.current || request !== generation.current) return;
        setUserId(profile.id);
        setParty(nextParty);
        setInvitations(nextInvitations);
        setFriends(nextFriends);
        setError("");
      } catch (failure) {
        if (mounted.current && request === generation.current)
          setError(
            failure instanceof Error
              ? failure.message
              : "Unable to load your party.",
          );
      } finally {
        if (mounted.current && request === generation.current)
          setLoading(false);
      }
    }, [client]);
    hooks.useEffect(() => {
      mounted.current = true;
      void refresh();
      const poll = () => {
        if (!actionPending.current) void refresh();
      };
      const unsubscribe = subscribe
        ? subscribe(poll)
        : (() => {
            const timer = setInterval(poll, 10_000);
            return () => clearInterval(timer);
          })();
      return () => {
        mounted.current = false;
        generation.current++;
        unsubscribe();
      };
    }, [refresh, subscribe]);
    const act = hooks.useCallback(
      async (action: LobbyGroupAction) => {
        if (actionPending.current) return;
        actionPending.current = true;
        generation.current++;
        setBusy(true);
        setStatus("");
        setError("");
        try {
          switch (action.type) {
            case "create":
              await client.party.create.mutate();
              break;
            case "leave":
              await client.party.leave.mutate();
              break;
            case "invite":
              await client.party.invite.mutate({
                recipientId: action.recipientId,
              });
              break;
            case "respond":
              await client.party.respond.mutate({
                id: action.id,
                accept: action.accept,
              });
              break;
            case "kick":
              await client.party.kick.mutate({ userId: action.userId });
              break;
            case "transfer":
              await client.party.transfer.mutate({ userId: action.userId });
              break;
            case "move":
              await client.party.move.mutate({ roomId: action.roomId });
              break;
          }
          if (mounted.current) {
            setStatus(
              action.type === "invite"
                ? "Party invitation sent."
                : action.type === "move"
                  ? "Party destination updated."
                  : "",
            );
            await refresh();
          }
        } catch (failure) {
          if (mounted.current)
            setError(
              failure instanceof Error
                ? failure.message
                : "Unable to update your party.",
            );
        } finally {
          actionPending.current = false;
          if (mounted.current) setBusy(false);
        }
      },
      [client, refresh],
    );
    return {
      party,
      invitations,
      friends,
      userId,
      loading,
      busy,
      status,
      error,
      refresh,
      act,
    };
  };
}
