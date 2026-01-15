"use client";

import { createContext, useContext, useCallback, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev";

type AuthFetchFunction = <T>(path: string, options?: RequestInit) => Promise<T>;

const AuthFetchContext = createContext<AuthFetchFunction | null>(null);

/**
 * 認証付きフェッチ関数を提供するプロバイダー
 * 子コンポーネントでuseAuthFetchを使用可能にする
 */
export function AuthFetchProvider({ children }: { children: ReactNode }) {
  const { getIdToken } = useAuth();

  const authFetch = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      const idToken = await getIdToken();

      // Firebase認証モードでトークンがない場合はエラー
      if (AUTH_MODE === "firebase" && !idToken) {
        throw new Error("認証トークンを取得できませんでした。再ログインしてください。");
      }

      return apiFetch<T>(path, {
        ...options,
        idToken: idToken ?? undefined,
      });
    },
    [getIdToken]
  );

  return (
    <AuthFetchContext.Provider value={authFetch}>
      {children}
    </AuthFetchContext.Provider>
  );
}

/**
 * 認証付きフェッチ関数を取得するフック
 */
export function useAuthFetch(): AuthFetchFunction {
  const context = useContext(AuthFetchContext);
  if (!context) {
    throw new Error("useAuthFetch must be used within an AuthFetchProvider");
  }
  return context;
}
