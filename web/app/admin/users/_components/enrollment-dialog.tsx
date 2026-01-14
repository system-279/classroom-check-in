"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
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

export function EnrollmentDialog({
  user,
  courses,
  enrollments,
  onClose,
  onSuccess,
}: Props) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));
  const availableCourses = courses.filter((c) => !enrolledCourseIds.has(c.id));

  const handleAdd = async () => {
    if (!user || !selectedCourseId) return;

    setAdding(true);
    setError(null);

    try {
      await apiFetch("/api/v1/admin/enrollments", {
        method: "POST",
        body: JSON.stringify({
          courseId: selectedCourseId,
          userId: user.id,
        }),
      });
      setSelectedCourseId("");
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

    try {
      await apiFetch(`/api/v1/admin/enrollments/${enrollmentId}`, {
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
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
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
            <div className="space-y-2">
              <h3 className="text-sm font-medium">講座を追加</h3>
              <div className="flex gap-2">
                <Select
                  value={selectedCourseId}
                  onValueChange={setSelectedCourseId}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="講座を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCourses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAdd}
                  disabled={!selectedCourseId || adding}
                >
                  {adding ? "追加中..." : "追加"}
                </Button>
              </div>
            </div>
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
