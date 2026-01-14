"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
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
import { SessionTable } from "./_components/session-table";
import { CloseSessionDialog } from "./_components/close-session-dialog";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closingSession, setClosingSession] = useState<Session | null>(null);

  const [filterCourseId, setFilterCourseId] = useState<string>("all");
  const [filterUserId, setFilterUserId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const fetchData = async () => {
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
        apiFetch<{ sessions: Session[] }>(sessionsPath),
        apiFetch<{ courses: Course[] }>("/api/v1/admin/courses"),
        apiFetch<{ users: User[] }>("/api/v1/admin/users"),
      ]);
      setSessions(sessionsData.sessions);
      setCourses(coursesData.courses);
      setUsers(usersData.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterCourseId, filterUserId, filterStatus]);

  const handleClose = (session: Session) => {
    setClosingSession(session);
  };

  const handleCloseSuccess = () => {
    setClosingSession(null);
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">セッション管理</h1>
      </div>

      <div className="flex gap-4">
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
