"use client";

import { createContext, useContext, type ReactNode } from "react";

type DemoModeContextType = {
  isDemo: boolean;
};

const DemoModeContext = createContext<DemoModeContextType>({ isDemo: false });

/**
 * デモモードプロバイダー
 * このプロバイダー配下のコンポーネントはデモモードで動作する
 */
export function DemoModeProvider({ children }: { children: ReactNode }) {
  return (
    <DemoModeContext.Provider value={{ isDemo: true }}>
      {children}
    </DemoModeContext.Provider>
  );
}

/**
 * デモモードかどうかを取得するフック
 */
export function useDemoMode(): boolean {
  const context = useContext(DemoModeContext);
  return context.isDemo;
}
