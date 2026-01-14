"use client";

import { useEffect, useState } from "react";

type Props = {
  startTime: string;
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

export function SessionTimer({ startTime }: Props) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

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

  return (
    <div className="text-center">
      <div className="text-4xl font-bold tabular-nums">
        {formatDuration(elapsedSeconds)}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">
        開始: {formatDateTime(startTime)}
      </div>
    </div>
  );
}
