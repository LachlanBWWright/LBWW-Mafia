import { clearMobileSession } from "../lib/mobileSession";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { persistAuthToken, restoreAuthToken } from "../lib/authStorage";
import { runInForeground } from "../lib/foreground";
import {
  subscribeAuthToken,
  getAuthToken,
  setAuthToken as setClientToken,
} from "../lib/authToken";
import { trpcClient } from "../lib/trpc";

type AppState = {
  playerName: string;
  setPlayerName: (value: string) => void;
  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
  lastRoomName: string;
  setLastRoomName: (value: string) => void;
  authToken: string | null;
  setAuthToken: (value: string | null) => void;
};

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [playerName, setPlayerName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastRoomName, setLastRoomName] = useState("default");
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeAuthToken((value) => {
        setAuthToken(value);
        if (!value) {
          setPlayerName("");
          setIsAdmin(false);
        }
      }),
    [],
  );
  useEffect(() => {
    let mounted = true;
    void restoreAuthToken(async (storedToken) => {
      if (!mounted) return;
      setClientToken(storedToken);
      setAuthToken(storedToken);
      try {
        const profile = await trpcClient.account.profile.query();
        if (mounted && getAuthToken() === storedToken) {
          setPlayerName(profile.handle ?? profile.name ?? "Player");
          setIsAdmin(profile.roles.includes("administrator"));
        }
      } catch {
        /* Keep credentials during a temporary network failure. */
      }
    }).catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!authToken) return;
    return runInForeground(() => {
      void trpcClient.presence.heartbeat.mutate().catch(() => undefined);
    }, 30_000);
  }, [authToken]);

  const updateAuthToken = useCallback((value: string | null) => {
    setClientToken(value);
    setAuthToken(value);
    if (!value) {
      void clearMobileSession();
      setPlayerName("");
      setIsAdmin(false);
    }
    void persistAuthToken(value).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({
      playerName,
      setPlayerName,
      isAdmin,
      setIsAdmin,
      lastRoomName,
      setLastRoomName,
      authToken,
      setAuthToken: updateAuthToken,
    }),
    [authToken, isAdmin, lastRoomName, playerName, updateAuthToken],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return value;
}
