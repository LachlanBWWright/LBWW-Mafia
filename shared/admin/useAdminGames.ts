import type * as React from "react";
import type { AdminGamePage, AdminGameQuery } from "./games";

export function createUseAdminGames(
  hooks: Pick<
    typeof React,
    "useState" | "useEffect" | "useRef" | "useCallback"
  >,
) {
  return function useAdminGames(
    load: (
      query: AdminGameQuery,
      signal: AbortSignal,
    ) => Promise<AdminGamePage>,
  ) {
    const [page, setPage] = hooks.useState<AdminGamePage | null>(null);
    const [query, setQuery] = hooks.useState<AdminGameQuery>({ offset: 0 });
    const [loading, setLoading] = hooks.useState(true);
    const [error, setError] = hooks.useState("");
    const active = hooks.useRef<AbortController | null>(null);
    const refresh = hooks.useCallback(async () => {
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      setLoading(true);
      setError("");
      try {
        const result = await load(query, controller.signal);
        if (!controller.signal.aborted) setPage(result);
      } catch {
        if (!controller.signal.aborted) {
          setPage(null);
          setError("Unable to load games. Try again.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, [load, query]);
    hooks.useEffect(() => {
      setPage(null);
      void refresh();
      return () => active.current?.abort();
    }, [refresh]);
    return { page, loading, error, refresh, query, setQuery };
  };
}
