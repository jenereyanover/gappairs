"use client";

import React, { ReactElement, useContext, useState } from "react";

export interface AppState {
  dimension: number;
  set: string;
  players: number; // 1 = solo, 2-5 = VS mode
  names: string[]; // optional player nicknames (index 0 = player 1)
  setImages: string[]; // selected image-set URLs to mix with emojis (empty = emojis only)
}

export type AppContextState = AppState & {
  setAppState: (state: Partial<AppState>) => void;
};

const AppContext = React.createContext<AppContextState>({
  dimension: 0,
  set: "emojis",
  players: 1,
  names: [],
  setImages: [],
  setAppState: () => {},
});

export default function AppProvider({
  children,
}: {
  children: ReactElement | React.ReactNode;
}) {
  const [state, setState] = useState<AppState>({
    dimension: 4,
    set: "emojis",
    players: 1,
    names: [],
    setImages: [],
  });

  const setAppState = (newState: Partial<AppState>) => {
    setState((prevState) => ({ ...prevState, ...newState }));
  };

  return (
    <AppContext.Provider value={{ ...state, setAppState }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
