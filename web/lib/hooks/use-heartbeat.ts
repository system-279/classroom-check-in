"use client";

import { useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { HeartbeatResponse } from "@/types/session";

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev";
const DEFAULT_INTERVAL_MS = 60_000; // 1分

export function useHeartbeat(
  sessionId: string | null,
  intervalMs: number = DEFAULT_INTERVAL_MS
) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { getIdToken } = useAuth();

  const sendHeartbeat = useCallback(async () => {
    if (!sessionId) return;

    try {
      const idToken = await getIdToken();

      // Firebase認証モードでトークンがない場合はスキップ
      if (AUTH_MODE === "firebase" && !idToken) {
        console.warn("Heartbeat skipped: No auth token available");
        return;
      }

      await apiFetch<HeartbeatResponse>("/api/v1/sessions/heartbeat", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
        idToken: idToken ?? undefined,
      });
    } catch (error) {
      // heartbeatエラーはログのみ（ユーザー操作を中断しない）
      console.warn("Heartbeat failed:", error);
    }
  }, [sessionId, getIdToken]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    // 即時送信
    sendHeartbeat();

    // 定期送信開始
    intervalRef.current = setInterval(sendHeartbeat, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sessionId, intervalMs, sendHeartbeat]);
}
