import type * as React from "react";
import type { SocialUser } from "../trpc/appRouter";
import type { LobbyInvitation } from "../trpc/accountFeatures";

type Client = {
  social: { friends: { query(): Promise<SocialUser[]> } };
  features: {
    hostedLobbies: { query(): Promise<{ roomId: string }[]> };
    sentInvitations: {
      query(input: { roomId: string }): Promise<LobbyInvitation[]>;
    };
    invite: {
      mutate(input: {
        roomId: string;
        recipientId: string;
      }): Promise<LobbyInvitation>;
    };
  };
};
export function createUseLobbyInvites(
  hooks: Pick<
    typeof React,
    "useState" | "useEffect" | "useCallback" | "useRef"
  >,
) {
  return function useLobbyInvites(
    client: Client,
    roomId: string,
    subscribe?: (refresh: () => void) => () => void,
  ) {
    const [friends, setFriends] = hooks.useState<SocialUser[]>([]);
    const [sent, setSent] = hooks.useState<LobbyInvitation[]>([]);
    const [isHost, setIsHost] = hooks.useState(false);
    const [error, setError] = hooks.useState("");
    const [busy, setBusy] = hooks.useState("");
    const mounted = hooks.useRef(false);
    const generation = hooks.useRef(0);
    const inFlight = hooks.useRef(false);
    const refresh = hooks.useCallback(async () => {
      const request = ++generation.current;
      try {
        const [hosted, people] = await Promise.all([
          client.features.hostedLobbies.query(),
          client.social.friends.query(),
        ]);
        const owner = hosted.some((lobby) => lobby.roomId === roomId);
        const invitations = owner
          ? await client.features.sentInvitations.query({ roomId })
          : [];
        if (!mounted.current || generation.current !== request) return;
        setIsHost(owner);
        setFriends(people.filter((person) => person.relationship === "friend"));
        setSent(invitations);
        setError("");
      } catch {
        if (mounted.current && generation.current === request)
          setError("Unable to load invitations.");
      }
    }, [client, roomId]);
    hooks.useEffect(() => {
      mounted.current = true;
      setIsHost(false);
      setSent([]);
      void refresh();
      const update = () => {
        if (!inFlight.current) void refresh();
      };
      const unsubscribe = subscribe
        ? subscribe(update)
        : (() => {
            const timer = setInterval(() => {
              if (typeof document === "undefined" || !document.hidden) update();
            }, 15000);
            return () => clearInterval(timer);
          })();
      return () => {
        mounted.current = false;
        generation.current++;
        unsubscribe();
      };
    }, [refresh, subscribe]);
    const invite = hooks.useCallback(
      async (recipientId: string) => {
        if (inFlight.current) return;
        inFlight.current = true;
        generation.current++;
        setBusy(recipientId);
        setError("");
        try {
          await client.features.invite.mutate({ roomId, recipientId });
          if (mounted.current) await refresh();
        } catch (failure) {
          if (mounted.current)
            setError(
              failure instanceof Error
                ? failure.message
                : "Unable to send invitation.",
            );
        } finally {
          inFlight.current = false;
          if (mounted.current) setBusy("");
        }
      },
      [client, roomId, refresh],
    );
    return { isHost, friends, sent, error, busy, invite };
  };
}
