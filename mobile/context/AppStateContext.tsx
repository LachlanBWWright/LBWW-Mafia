import React, { createContext, useContext, useMemo, useState } from "react";

type AppState = {
  playerName: string;
  setPlayerName: (value: string) => void;
  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
  lastRoomName: string;
  setLastRoomName: (value: string) => void;
};

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [playerName, setPlayerName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastRoomName, setLastRoomName] = useState("default");

  const value = useMemo(
    () => ({
      playerName,
      setPlayerName,
      isAdmin,
      setIsAdmin,
      lastRoomName,
      setLastRoomName,
    }),
    [isAdmin, lastRoomName, playerName],
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
