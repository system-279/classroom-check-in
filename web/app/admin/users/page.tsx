"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import type { User } from "@/types/user";
import type { Course } from "@/types/course";
import type { Enrollment } from "@/types/enrollment";
import type { Session } from "@/types/session";
import { UserTable } from "./_components/user-table";
import { UserFormDialog } from "./_components/user-form-dialog";
import { EnrollmentDialog } from "./_components/enrollment-dialog";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [openSessions, setOpenSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [enrollmentDialogUser, setEnrollmentDialogUser] = useState<User | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, coursesData, enrollmentsData, sessionsData] = await Promise.all([
        apiFetch<{ users: User[] }>("/api/v1/admin/users"),
        apiFetch<{ courses: Course[] }>("/api/v1/admin/courses"),
        apiFetch<{ enrollments: Enrollment[] }>("/api/v1/admin/enrollments"),
        apiFetch<{ sessions: Session[] }>("/api/v1/admin/sessions?status=open"),
      ]);
      setUsers(usersData.users);
      setCourses(coursesData.courses);
      setEnrollments(enrollmentsData.enrollments);
      setOpenSessions(sessionsData.sessions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = () => {
    setEditingUser(null);
    setDialogOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setDialogOpen(true);
  };

  const handleEnrollments = (user: User) => {
    setEnrollmentDialogUser(user);
  };

  const handleSuccess = () => {
    setDialogOpen(false);
    setEditingUser(null);
    fetchData();
  };

  const handleEnrollmentSuccess = () => {
    setEnrollmentDialogUser(null);
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">受講者管理</h1>
        <Button onClick={handleCreate}>新規作成</Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground">読み込み中...</div>
      ) : (
        <UserTable
          users={users}
          courses={courses}
          enrollments={enrollments}
          openSessions={openSessions}
          onEdit={handleEdit}
          onEnrollments={handleEnrollments}
          onDelete={fetchData}
        />
      )}

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editingUser}
        onSuccess={handleSuccess}
      />

      <EnrollmentDialog
        user={enrollmentDialogUser}
        courses={courses}
        enrollments={enrollments.filter((e) => e.userId === enrollmentDialogUser?.id)}
        onClose={() => setEnrollmentDialogUser(null)}
        onSuccess={handleEnrollmentSuccess}
      />
    </div>
  );
}
