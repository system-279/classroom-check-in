"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthFetch } from "@/lib/auth-fetch-context";
import type { User } from "@/types/user";
import type { Course } from "@/types/course";
import type { Enrollment } from "@/types/enrollment";

type Props = {
  user: User | null;
  courses: Course[];
  enrollments: Enrollment[];
  onClose: () => void;
  onSuccess: () => void;
};

type BulkEnrollmentResponse = {
  enrollments: Enrollment[];
  skipped: string[];
  notFound: string[];
  summary: {
    created: number;
    skipped: number;
    notFound: number;
  };
};

export function EnrollmentDialog({
  user,
  courses,
  enrollments,
  onClose,
  onSuccess,
}: Props) {
  const authFetch = useAuthFetch();
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));
  const availableCourses = courses.filter((c) => !enrolledCourseIds.has(c.id));

  const handleToggleCourse = (courseId: string) => {
    setSelectedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedCourseIds(new Set(availableCourses.map((c) => c.id)));
  };

  const handleDeselectAll = () => {
    setSelectedCourseIds(new Set());
  };

  const handleBulkAdd = async () => {
    if (!user || selectedCourseIds.size === 0) return;

    setAdding(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await authFetch<BulkEnrollmentResponse>("/api/v1/admin/enrollments/bulk", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          courseIds: Array.from(selectedCourseIds),
        }),
      });

      const messages: string[] = [];
      if (response.summary.created > 0) {
        messages.push(`${response.summary.created}件を登録しました`);
      }
      if (response.summary.skipped > 0) {
        messages.push(`${response.summary.skipped}件は既に登録済みのためスキップしました`);
      }
      if (response.summary.notFound > 0) {
        messages.push(`${response.summary.notFound}件の講座が見つかりませんでした`);
      }
      setSuccessMessage(messages.join("、"));
      setSelectedCourseIds(new Set());
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (enrollmentId: string) => {
    setRemovingId(enrollmentId);
    setError(null);
    setSuccessMessage(null);

    try {
      await authFetch(`/api/v1/admin/enrollments/${enrollmentId}`, {
        method: "DELETE",
      });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "解除に失敗しました");
    } finally {
      setRemovingId(null);
    }
  };

  const getCourseName = (courseId: string) => {
    return courses.find((c) => c.id === courseId)?.name ?? courseId;
  };

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {user?.name || user?.email} の受講講座
          </DialogTitle>
          <DialogDescription>
            受講する講座を選択して登録できます。チェックボックスで複数選択が可能です。
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="rounded-md bg-green-100 p-3 text-sm text-green-800">
            {successMessage}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">登録済み講座</h3>
            {enrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                登録されている講座はありません
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {enrollments.map((enrollment) => (
                  <Badge
                    key={enrollment.id}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {getCourseName(enrollment.courseId)}
                    <button
                      type="button"
                      className="ml-1 hover:text-destructive disabled:opacity-50"
                      onClick={() => handleRemove(enrollment.id)}
                      disabled={removingId === enrollment.id}
                    >
                      {removingId === enrollment.id ? "..." : "×"}
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {availableCourses.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">講座を追加</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={selectedCourseIds.size === availableCourses.length}
                  >
                    全選択
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAll}
                    disabled={selectedCourseIds.size === 0}
                  >
                    全解除
                  </Button>
                </div>
              </div>

              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                {availableCourses.map((course) => (
                  <label
                    key={course.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted"
                  >
                    <Checkbox
                      checked={selectedCourseIds.has(course.id)}
                      onCheckedChange={() => handleToggleCourse(course.id)}
                    />
                    <span className="text-sm">{course.name}</span>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedCourseIds.size}件選択中
                </span>
                <Button
                  onClick={handleBulkAdd}
                  disabled={selectedCourseIds.size === 0 || adding}
                >
                  {adding ? "登録中..." : `${selectedCourseIds.size}件を一括登録`}
                </Button>
              </div>
            </div>
          )}

          {availableCourses.length === 0 && enrollments.length > 0 && (
            <p className="text-sm text-muted-foreground">
              全ての講座が登録済みです
            </p>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
