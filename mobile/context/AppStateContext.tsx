import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { setAuthToken as setClientToken } from "../lib/authToken";

const AUTH_TOKEN_KEY = "lbww-auth-token";

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

  useEffect(() => {
    void SecureStore.getItemAsync(AUTH_TOKEN_KEY).then((storedToken) => {
      if (storedToken) {
        setClientToken(storedToken);
        setAuthToken(storedToken);
      }
    });
  }, []);

  const updateAuthToken = useCallback((value: string | null) => {
    setClientToken(value);
    setAuthToken(value);
    void (value
      ? SecureStore.setItemAsync(AUTH_TOKEN_KEY, value)
      : SecureStore.deleteItemAsync(AUTH_TOKEN_KEY));
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
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return value;
}
