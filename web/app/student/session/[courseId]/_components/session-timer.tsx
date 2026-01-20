"use client";

import { useEffect, useState } from "react";

type Props = {
  startTime: string;
  requiredWatchMin?: number;
  onTimeReached?: (reached: boolean) => void;
};

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs]
    .map((n) => n.toString().padStart(2, "0"))
    .join(":");
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionTimer({ startTime, requiredWatchMin, onTimeReached }: Props) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const requiredSeconds = requiredWatchMin ? requiredWatchMin * 60 : 0;
  const remainingSeconds = Math.max(0, requiredSeconds - elapsedSeconds);
  const hasReachedRequired = requiredWatchMin ? elapsedSeconds >= requiredSeconds : true;
  const progressPercent = requiredSeconds > 0
    ? Math.min(100, (elapsedSeconds / requiredSeconds) * 100)
    : 100;

  useEffect(() => {
    const startDate = new Date(startTime);

    const updateElapsed = () => {
      const now = new Date();
      const diffMs = now.getTime() - startDate.getTime();
      setElapsedSeconds(Math.max(0, Math.floor(diffMs / 1000)));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  // 達成状態を親に通知
  useEffect(() => {
    if (onTimeReached) {
      onTimeReached(hasReachedRequired);
    }
  }, [hasReachedRequired, onTimeReached]);

  return (
    <div className="text-center space-y-3">
      <div className="text-4xl font-bold tabular-nums">
        {formatDuration(elapsedSeconds)}
      </div>
      <div className="text-sm text-muted-foreground">
        開始: {formatDateTime(startTime)}
      </div>

      {requiredWatchMin && (
        <div className="space-y-2">
          {/* プログレスバー */}
          <div className="w-full max-w-xs mx-auto h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                hasReachedRequired ? "bg-green-500" : "bg-blue-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* 必要時間表示 */}
          <div className={`text-sm ${hasReachedRequired ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
            {hasReachedRequired ? (
              <span>✓ 必要視聴時間（{requiredWatchMin}分）に達しました</span>
            ) : (
              <span>
                必要視聴時間まで残り{" "}
                <span className="font-semibold tabular-nums">
                  {formatDuration(remainingSeconds)}
                </span>
                （{requiredWatchMin}分必要）
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
