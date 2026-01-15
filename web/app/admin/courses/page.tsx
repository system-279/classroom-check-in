"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuthFetch } from "@/lib/auth-fetch-context";
import { useAuth } from "@/lib/auth-context";
import type { Course } from "@/types/course";
import { CourseTable } from "./_components/course-table";
import { CourseFormDialog } from "./_components/course-form-dialog";

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev";

export default function CoursesPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const { user, loading: authLoading } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authFetch<{ courses: Course[] }>("/api/v1/admin/courses");
      setCourses(data.courses);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch courses");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    // Firebase認証モードで未認証の場合はホームへリダイレクト
    if (AUTH_MODE === "firebase" && !authLoading && !user) {
      router.push("/");
      return;
    }
    if (AUTH_MODE === "firebase" && authLoading) {
      return;
    }
    fetchCourses();
  }, [authLoading, user, router, fetchCourses]);

  const handleCreate = () => {
    setEditingCourse(null);
    setDialogOpen(true);
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setDialogOpen(true);
  };

  const handleSuccess = () => {
    setDialogOpen(false);
    setEditingCourse(null);
    fetchCourses();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">講座管理</h1>
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
        <CourseTable
          courses={courses}
          onEdit={handleEdit}
          onDelete={fetchCourses}
        />
      )}

      <CourseFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        course={editingCourse}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
