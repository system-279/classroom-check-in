"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAuthFetch } from "@/lib/auth-fetch-context";
import type { Course } from "@/types/course";
import { CourseCard } from "./_components/course-card";

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev";

export default function StudentCoursesPage() {
  const router = useRouter();
  const { user, loading: authLoading, isDemo } = useAuth();
  const authFetch = useAuthFetch();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authFetch<{ courses: Course[] }>("/api/v1/courses");
      setCourses(data.courses);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "講座の取得に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    // デモモードでは認証チェックをスキップ
    if (isDemo) {
      fetchCourses();
      return;
    }

    // Firebase認証モードで未認証の場合はホームへリダイレクト
    if (AUTH_MODE === "firebase" && !authLoading && !user) {
      router.push("/");
      return;
    }

    // 認証確認中は待機
    if (AUTH_MODE === "firebase" && authLoading) {
      return;
    }

    fetchCourses();
  }, [authLoading, user, router, isDemo, fetchCourses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">講座一覧</h1>
        <p className="text-sm text-muted-foreground">
          受講する講座を選択してください
        </p>
      </div>

      {/* 受講時の注意事項 */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-200">
          <span className="text-lg">⚠️</span>
          受講時の注意事項
        </h2>
        <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
          <li>・同時並行で講座は受けられません。</li>
          <li>・分割での動画視聴は不可です。全て最初から最後まで、倍速などの再生速度を早くする変更はせずにご視聴ください。</li>
        </ul>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            受講可能な講座がありません
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
