"use client";

import { useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import type { HeartbeatResponse } from "@/types/session";

const DEFAULT_INTERVAL_MS = 60_000; // 1分

export function useHeartbeat(
  sessionId: string | null,
  intervalMs: number = DEFAULT_INTERVAL_MS
) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const sendHeartbeat = async () => {
      try {
        await apiFetch<HeartbeatResponse>("/api/v1/sessions/heartbeat", {
          method: "POST",
          body: JSON.stringify({ sessionId }),
        });
      } catch (error) {
        // heartbeatエラーはログのみ（ユーザー操作を中断しない）
        console.warn("Heartbeat failed:", error);
      }
    };

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
  }, [sessionId, intervalMs]);
}
