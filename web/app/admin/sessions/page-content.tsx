"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthFetch } from "@/lib/auth-fetch-context";
import { useAuth } from "@/lib/auth-context";
import { useTenantOptional } from "@/lib/tenant-context";
import type { Session } from "@/types/session";
import type { Course } from "@/types/course";
import type { User } from "@/types/user";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SessionTable } from "./_components/session-table";
import { CloseSessionDialog } from "./_components/close-session-dialog";
import { toCsv, downloadCsv } from "@/lib/csv";

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev";

export default function SessionsPage() {
  const router = useRouter();
  const tenant = useTenantOptional();
  const authFetch = useAuthFetch();
  const { user: authUser, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closingSession, setClosingSession] = useState<Session | null>(null);

  const [filterCourseId, setFilterCourseId] = useState<string>("all");
  const [filterUserId, setFilterUserId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterCourseId !== "all") params.append("courseId", filterCourseId);
      if (filterUserId !== "all") params.append("userId", filterUserId);
      if (filterStatus !== "all") params.append("status", filterStatus);

      const queryString = params.toString();
      const sessionsPath = `/api/v1/admin/sessions${queryString ? `?${queryString}` : ""}`;

      const [sessionsData, coursesData, usersData] = await Promise.all([
        authFetch<{ sessions: Session[] }>(sessionsPath),
        authFetch<{ courses: Course[] }>("/api/v1/admin/courses"),
        authFetch<{ users: User[] }>("/api/v1/admin/users"),
      ]);
      setSessions(sessionsData.sessions);
      setCourses(coursesData.courses);
      setUsers(usersData.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [authFetch, filterCourseId, filterUserId, filterStatus]);

  useEffect(() => {
    if (AUTH_MODE === "firebase" && !authLoading && !authUser) {
      router.push(tenant ? `/${tenant.tenantId}` : "/");
      return;
    }
    if (AUTH_MODE === "firebase" && authLoading) {
      return;
    }
    fetchData();
  }, [authLoading, authUser, router, fetchData]);

  const handleClose = (session: Session) => {
    setClosingSession(session);
  };

  const handleCloseSuccess = () => {
    setClosingSession(null);
    fetchData();
  };

  const handleDownloadCsv = () => {
    const getCourseName = (courseId: string) =>
      courses.find((c) => c.id === courseId)?.name ?? courseId;
    const getUserName = (userId: string) => {
      const user = users.find((u) => u.id === userId);
      return user?.name || user?.email || userId;
    };
    const formatDateTime = (dateString: string | null) => {
      if (!dateString) return "";
      const date = new Date(dateString);
      return date.toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    };
    const formatDurationMin = (seconds: number) => {
      if (seconds === 0) return "";
      return Math.round(seconds / 60);
    };
    const statusLabel: Record<string, string> = {
      open: "継続中",
      closed: "終了",
      adjusted: "補正済",
    };

    const csvData = sessions.map((s) => ({
      userName: getUserName(s.userId),
      courseName: getCourseName(s.courseId),
      startTime: formatDateTime(s.startTime),
      endTime: formatDateTime(s.endTime),
      durationMin: formatDurationMin(s.durationSec),
      status: statusLabel[s.status] ?? s.status,
    }));

    const csv = toCsv(csvData, [
      { key: "userName", label: "ユーザー" },
      { key: "courseName", label: "講座" },
      { key: "startTime", label: "開始日時" },
      { key: "endTime", label: "終了日時" },
      { key: "durationMin", label: "滞在時間（分）" },
      { key: "status", label: "状態" },
    ]);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    downloadCsv(csv, `sessions_${dateStr}.csv`);
  };

  // ADR-0026: セッション削除（リセット）
  const handleDelete = async (session: Session) => {
    const user = users.find((u) => u.id === session.userId);
    const course = courses.find((c) => c.id === session.courseId);
    const userName = user?.name || user?.email || session.userId;
    const courseName = course?.name || session.courseId;

    const confirmed = window.confirm(
      `セッションを削除しますか？\n\n` +
      `ユーザー: ${userName}\n` +
      `講座: ${courseName}\n\n` +
      `削除すると、このユーザーは再度この講座に入室できるようになります。`
    );

    if (!confirmed) return;

    try {
      await authFetch(`/api/v1/admin/sessions/${session.id}`, {
        method: "DELETE",
      });
      fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">セッション管理</h1>
      </div>

      <div className="flex gap-4 flex-wrap items-center">
        <div className="w-48">
          <Select value={filterCourseId} onValueChange={setFilterCourseId}>
            <SelectTrigger>
              <SelectValue placeholder="講座でフィルタ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての講座</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Select value={filterUserId} onValueChange={setFilterUserId}>
            <SelectTrigger>
              <SelectValue placeholder="ユーザーでフィルタ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべてのユーザー</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name || user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="状態でフィルタ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="open">継続中</SelectItem>
              <SelectItem value="closed">終了</SelectItem>
              <SelectItem value="adjusted">補正済</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto">
          <Button
            variant="outline"
            onClick={handleDownloadCsv}
            disabled={loading || sessions.length === 0}
          >
            CSVダウンロード
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground">読み込み中...</div>
      ) : (
        <SessionTable
          sessions={sessions}
          courses={courses}
          users={users}
          onClose={handleClose}
          onDelete={handleDelete}
        />
      )}

      <CloseSessionDialog
        session={closingSession}
        courses={courses}
        users={users}
        onClose={() => setClosingSession(null)}
        onSuccess={handleCloseSuccess}
      />
    </div>
  );
}
