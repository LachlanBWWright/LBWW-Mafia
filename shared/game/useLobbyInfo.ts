import type * as React from "react";
import { requestLobbyInfo, type LobbyInfo } from "./lobbyInfo";
export function createUseLobbyInfo(
  hooks: Pick<typeof React, "useEffect" | "useState">,
) {
  return function useLobbyInfo(roomId: string, baseUrl = "", enabled = true) {
    const [result, setResult] = hooks.useState<{
      info: LobbyInfo | null;
      status: "loading" | "ready" | "unavailable";
    }>({ info: null, status: "loading" });
    hooks.useEffect(() => {
      if (!enabled) return;
      let active = true;
      const load = () =>
        void requestLobbyInfo(roomId, baseUrl)
          .then((info) => {
            if (active)
              setResult({ info, status: info ? "ready" : "unavailable" });
          })
          .catch(() => {
            if (active) setResult({ info: null, status: "unavailable" });
          });
      load();
      const timer = setInterval(load, 15000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [roomId, baseUrl, enabled]);
    return result;
  };
}
