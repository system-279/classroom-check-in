"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Course } from "@/types/course";
import { CourseCard } from "./_components/course-card";

export default function StudentCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ courses: Course[] }>("/api/v1/courses");
        setCourses(data.courses);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "講座の取得に失敗しました"
        );
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

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
