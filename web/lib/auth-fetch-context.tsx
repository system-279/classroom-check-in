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
 * デモモードの場合は /api/v1/demo/* パスを使用
 */
export function AuthFetchProvider({ children }: { children: ReactNode }) {
  const { getIdToken, isDemo } = useAuth();

  const authFetch = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      // デモモードの場合はパスを変換（より堅牢な実装）
      let actualPath = path;
      if (isDemo) {
        // 既にdemoパスの場合はそのまま
        if (!path.includes("/api/v1/demo")) {
          // /api/v1 または /api/v1/ で始まるパスを変換
          if (path.startsWith("/api/v1/")) {
            actualPath = path.replace("/api/v1/", "/api/v1/demo/");
          } else if (path === "/api/v1") {
            actualPath = "/api/v1/demo";
          }
        }
      }

      // デモモードではトークン不要
      if (isDemo) {
        return apiFetch<T>(actualPath, options);
      }

      const idToken = await getIdToken();

      // Firebase認証モードでトークンがない場合はエラー
      if (AUTH_MODE === "firebase" && !idToken) {
        throw new Error("認証トークンを取得できませんでした。再ログインしてください。");
      }

      return apiFetch<T>(actualPath, {
        ...options,
        idToken: idToken ?? undefined,
      });
    },
    [getIdToken, isDemo]
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
