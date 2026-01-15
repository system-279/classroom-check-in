"use client";

import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { Course } from "@/types/course";

type Props = {
  course: Course;
};

function formatDuration(seconds: number): string {
  if (seconds === 0) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}時間${minutes > 0 ? `${minutes}分` : ""}`;
  }
  return `${minutes}分`;
}

function formatDate(isoString: string | null): string {
  if (!isoString) return "-";
  const date = new Date(isoString);
  return date.toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  });
}

export function CourseCard({ course }: Props) {
  const summary = course.sessionSummary;

  return (
    <Link href={`/student/session/${course.id}`}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg">{course.name}</CardTitle>
            {summary?.hasActiveSession && (
              <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                受講中
              </span>
            )}
          </div>
          {course.description && (
            <CardDescription className="line-clamp-2">
              {course.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {summary && summary.sessionCount > 0 && (
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>最終: {formatDate(summary.lastSessionAt)}</span>
              <span>累計: {formatDuration(summary.totalDurationSec)}</span>
            </div>
          )}
          {course.classroomUrl && (
            <span className="text-xs text-muted-foreground">
              Google Classroom連携あり
            </span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
