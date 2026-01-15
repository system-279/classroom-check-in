import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, type ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev";

type FetchOptions = RequestInit;

/**
 * 認証付きAPIフェッチフック
 * Firebase認証モードの場合、自動的にIDトークンを付与する
 */
export function useAuthenticatedFetch() {
  const router = useRouter();
  const { user, loading: authLoading, getIdToken } = useAuth();

  const authFetch = useCallback(
    async <T>(path: string, options: FetchOptions = {}): Promise<T> => {
      // Firebase認証モードで未認証の場合はホームへリダイレクト
      if (AUTH_MODE === "firebase" && !authLoading && !user) {
        router.push("/");
        throw new Error("認証が必要です");
      }

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
    [user, authLoading, getIdToken, router]
  );

  return {
    authFetch,
    user,
    authLoading,
    isAuthenticated: AUTH_MODE !== "firebase" || !!user,
  };
}
