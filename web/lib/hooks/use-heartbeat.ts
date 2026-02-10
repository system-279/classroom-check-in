"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuthenticatedFetch } from "@/lib/hooks/use-authenticated-fetch";
import type { HeartbeatResponse } from "@/types/session";

const DEFAULT_INTERVAL_MS = 60_000; // 1分

export function useHeartbeat(
  sessionId: string | null,
  intervalMs: number = DEFAULT_INTERVAL_MS
) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { authFetch } = useAuthenticatedFetch();

  const sendHeartbeat = useCallback(async () => {
    if (!sessionId) return;

    try {
      await authFetch<HeartbeatResponse>("/api/v1/sessions/heartbeat", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
    } catch (error) {
      // heartbeatエラーはログのみ（ユーザー操作を中断しない）
      console.warn("Heartbeat failed:", error);
    }
  }, [sessionId, authFetch]);

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
