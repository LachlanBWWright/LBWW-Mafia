import type * as React from "react";
import { requestPublicLobbyPage, type PublicLobby } from "./publicLobbies";

export function createUsePublicLobbies(
  hooks: Pick<
    typeof React,
    "useState" | "useEffect" | "useRef" | "useCallback"
  >,
) {
  return function usePublicLobbies(
    baseUrl = "",
    subscribe?: (refresh: () => void) => () => void,
  ) {
    const [lobbies, setLobbies] = hooks.useState<PublicLobby[]>([]);
    const [next, setNext] = hooks.useState<number | null>(null);
    const [status, setStatus] = hooks.useState<"loading" | "ready" | "error">(
      "loading",
    );
    const pages = hooks.useRef(1);
    const generation = hooks.useRef(0);
    const mounted = hooks.useRef(false);
    const load = hooks.useCallback(
      async (offset = 0) => {
        const request = ++generation.current;
        setStatus("loading");
        try {
          const page = await requestPublicLobbyPage(baseUrl, offset);
          if (!mounted.current || request !== generation.current) return;
          pages.current = offset ? Math.floor(offset / 50) + 1 : 1;
          setLobbies((current) =>
            offset
              ? [
                  ...new Map(
                    [...current, ...page.lobbies].map((item) => [
                      item.roomId,
                      item,
                    ]),
                  ).values(),
                ]
              : page.lobbies,
          );
          setNext(page.nextOffset ?? null);
          setStatus("ready");
        } catch {
          if (mounted.current && request === generation.current)
            setStatus("error");
        }
      },
      [baseUrl],
    );
    const refresh = hooks.useCallback(async () => {
      const request = ++generation.current;
      try {
        const results = await Promise.all(
          Array.from({ length: pages.current }, (_, index) =>
            requestPublicLobbyPage(baseUrl, index * 50),
          ),
        );
        if (!mounted.current || request !== generation.current) return;
        setLobbies([
          ...new Map(
            results
              .flatMap((page) => page.lobbies)
              .map((item) => [item.roomId, item]),
          ).values(),
        ]);
        setNext(results.at(-1)?.nextOffset ?? null);
        setStatus("ready");
      } catch {
        if (mounted.current && request === generation.current)
          setStatus("error");
      }
    }, [baseUrl]);
    hooks.useEffect(() => {
      mounted.current = true;
      void load();
      const update = () => void refresh();
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
    }, [load, refresh, subscribe]);
    return { lobbies, next, status, load, refresh };
  };
}
