"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthenticatedFetch } from "@/lib/hooks/use-authenticated-fetch";
import { useHeartbeat } from "@/lib/hooks/use-heartbeat";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Course } from "@/types/course";
import type {
  Session,
  CheckInResponse,
  CheckOutResponse,
  ActiveSessionResponse,
} from "@/types/session";
import { SessionTimer } from "./_components/session-timer";
import { ClassroomLink } from "./_components/classroom-link";

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev";

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  // P2-1.3修正: useParamsの型を安全に処理
  const courseId = Array.isArray(params.courseId)
    ? params.courseId[0]
    : params.courseId;

  const { authFetch, authLoading, isAuthenticated } = useAuthenticatedFetch();
  const [course, setCourse] = useState<Course | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // heartbeat: セッションがopenの場合のみ送信
  useHeartbeat(session?.status === "open" ? session.id : null);

  // 講座情報を取得し、既存のopenセッションがあるか確認
  useEffect(() => {
    // Firebase認証モードで未認証の場合はホームへリダイレクト
    if (AUTH_MODE === "firebase" && !authLoading && !isAuthenticated) {
      router.push("/");
      return;
    }

    // 認証確認中は待機
    if (AUTH_MODE === "firebase" && authLoading) {
      return;
    }

    if (!courseId) {
      setError("講座IDが指定されていません");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // 講座一覧から該当講座を取得
        const coursesData = await authFetch<{ courses: Course[] }>(
          "/api/v1/courses"
        );
        const targetCourse = coursesData.courses.find((c) => c.id === courseId);
        if (!targetCourse) {
          setError("講座が見つかりません");
          return;
        }
        setCourse(targetCourse);

        // P1修正: サーバー側でアクティブセッションを確認（LocalStorage依存を削除）
        const activeData = await authFetch<ActiveSessionResponse>(
          `/api/v1/sessions/active?courseId=${courseId}`
        );
        if (activeData.session) {
          setSession(activeData.session);
        }
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "データの取得に失敗しました"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [courseId, authLoading, isAuthenticated, router, authFetch]);

  const handleCheckIn = async () => {
    if (!course || !courseId) return;

    setActionLoading(true);
    setError(null);

    try {
      const data = await authFetch<CheckInResponse>(
        "/api/v1/sessions/check-in",
        {
          method: "POST",
          body: JSON.stringify({ courseId }),
        }
      );
      setSession(data.session);

      // Classroomを新規タブで開く（新規セッションの場合のみ）
      if (!data.alreadyOpen && course.classroomUrl) {
        window.open(course.classroomUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "入室に失敗しました");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!session) return;

    setActionLoading(true);
    setError(null);

    try {
      await authFetch<CheckOutResponse>("/api/v1/sessions/check-out", {
        method: "POST",
        body: JSON.stringify({ sessionId: session.id }),
      });
      setSession(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "退室に失敗しました");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (error && !course) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
        <Link href="/student/courses">
          <Button variant="outline">講座一覧に戻る</Button>
        </Link>
      </div>
    );
  }

  const isSessionActive = session?.status === "open";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/student/courses"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 講座一覧に戻る
        </Link>
      </div>

      {course && (
        <div>
          <h1 className="text-2xl font-bold">{course.name}</h1>
          {course.description && (
            <p className="mt-1 text-muted-foreground">{course.description}</p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {isSessionActive ? "セッション進行中" : "入室"}
          </CardTitle>
          <CardDescription>
            {isSessionActive
              ? "受講中です。終了したら退室ボタンを押してください。"
              : "INボタンを押すと入室を記録します。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isSessionActive && session ? (
            <>
              <SessionTimer startTime={session.startTime} />
              <div className="flex flex-col items-center gap-4">
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handleCheckOut}
                  disabled={actionLoading}
                  className="w-full max-w-xs"
                >
                  {actionLoading ? "処理中..." : "OUT（退室）"}
                </Button>
                {course?.classroomUrl && (
                  <ClassroomLink url={course.classroomUrl} />
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Button
                size="lg"
                onClick={handleCheckIn}
                disabled={actionLoading}
                className="w-full max-w-xs"
              >
                {actionLoading ? "処理中..." : "IN（入室）"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {course?.classroomUrl
                  ? "入室後、Google Classroomが新規タブで開きます"
                  : "入室を記録します"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
