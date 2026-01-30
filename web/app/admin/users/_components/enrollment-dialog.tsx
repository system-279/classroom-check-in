"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

/**
 * 登録済み講座カード（選択可能）
 */
function EnrolledCourseCard({
  course,
  isSelected,
  isProcessing,
  onToggle,
}: {
  course: Course;
  isSelected: boolean;
  isProcessing: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isProcessing}
      className={`
        group flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left
        transition-all duration-200
        ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}
        ${
          isSelected
            ? "border-red-300 bg-gradient-to-r from-red-50 to-orange-50 shadow-md"
            : "border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 hover:border-emerald-300 hover:shadow-md"
        }
        active:scale-[0.98]
      `}
    >
      <div
        className={`
          flex h-10 w-10 items-center justify-center rounded-full
          transition-all duration-200 shadow-sm
          ${
            isSelected
              ? "bg-red-500 text-white"
              : "bg-emerald-500 text-white"
          }
        `}
      >
        {isSelected ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div className="flex flex-col">
        <span className={`font-semibold ${isSelected ? "text-red-900" : "text-emerald-900"}`}>
          {course.name}
        </span>
        <span className={`text-xs ${isSelected ? "text-red-600" : "text-emerald-600"}`}>
          {isSelected ? "解除予定（クリックで取消）" : "登録済み（クリックで選択）"}
        </span>
      </div>
    </button>
  );
}

/**
 * 未登録講座カード（選択可能）
 */
function AvailableCourseCard({
  course,
  isSelected,
  onToggle,
}: {
  course: Course;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        group flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left
        transition-all duration-200
        ${
          isSelected
            ? "border-blue-400 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-md"
            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
        }
        active:scale-[0.98]
      `}
    >
      <div
        className={`
          flex h-10 w-10 items-center justify-center rounded-full
          transition-all duration-200
          ${
            isSelected
              ? "bg-blue-500 text-white shadow-sm"
              : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
          }
        `}
      >
        {isSelected ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        )}
      </div>
      <div className="flex flex-col">
        <span className={`font-medium ${isSelected ? "text-blue-900" : "text-slate-700"}`}>
          {course.name}
        </span>
        <span className={`text-xs ${isSelected ? "text-blue-600" : "text-slate-400"}`}>
          {isSelected ? "選択中（クリックで解除）" : "クリックして選択"}
        </span>
      </div>
    </button>
  );
}

export function EnrollmentDialog({
  user,
  courses,
  enrollments,
  onClose,
  onSuccess,
}: Props) {
  const authFetch = useAuthFetch();
  // 未登録講座の選択（追加用）
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  // 登録済み講座の選択（削除用）
  const [selectedToRemove, setSelectedToRemove] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));
  const enrolledCourses = courses.filter((c) => enrolledCourseIds.has(c.id));
  const availableCourses = courses.filter((c) => !enrolledCourseIds.has(c.id));

  // 未登録講座の選択トグル
  const handleToggleToAdd = useCallback((courseId: string) => {
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  }, []);

  // 登録済み講座の選択トグル
  const handleToggleToRemove = useCallback((courseId: string) => {
    setSelectedToRemove((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  }, []);

  // 未登録講座の全選択/解除
  const handleSelectAllToAdd = useCallback(() => {
    setSelectedToAdd(new Set(availableCourses.map((c) => c.id)));
  }, [availableCourses]);

  const handleDeselectAllToAdd = useCallback(() => {
    setSelectedToAdd(new Set());
  }, []);

  // 登録済み講座の全選択/解除
  const handleSelectAllToRemove = useCallback(() => {
    setSelectedToRemove(new Set(enrolledCourses.map((c) => c.id)));
  }, [enrolledCourses]);

  const handleDeselectAllToRemove = useCallback(() => {
    setSelectedToRemove(new Set());
  }, []);

  // 一括登録
  const handleBulkAdd = async () => {
    if (!user || selectedToAdd.size === 0) return;

    setAdding(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await authFetch<BulkEnrollmentResponse>("/api/v1/admin/enrollments/bulk", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          courseIds: Array.from(selectedToAdd),
        }),
      });

      const messages: string[] = [];
      if (response.summary.created > 0) {
        messages.push(`${response.summary.created}件を登録しました`);
      }
      if (response.summary.skipped > 0) {
        messages.push(`${response.summary.skipped}件は既に登録済み`);
      }
      if (response.summary.notFound > 0) {
        messages.push(`${response.summary.notFound}件は見つかりませんでした`);
      }
      setSuccessMessage(messages.join(" / "));
      setSelectedToAdd(new Set());
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setAdding(false);
    }
  };

  // 一括削除
  const handleBulkRemove = async () => {
    if (selectedToRemove.size === 0) return;

    setRemoving(true);
    setError(null);
    setSuccessMessage(null);

    const enrollmentIds = Array.from(selectedToRemove)
      .map((courseId) => enrollments.find((e) => e.courseId === courseId)?.id)
      .filter((id): id is string => !!id);

    let successCount = 0;
    let errorCount = 0;

    for (const enrollmentId of enrollmentIds) {
      try {
        await authFetch(`/api/v1/admin/enrollments/${enrollmentId}`, {
          method: "DELETE",
        });
        successCount++;
      } catch {
        errorCount++;
      }
    }

    if (errorCount === 0) {
      setSuccessMessage(`${successCount}件の登録を解除しました`);
    } else {
      setSuccessMessage(`${successCount}件を解除、${errorCount}件は失敗`);
    }
    setSelectedToRemove(new Set());
    onSuccess();
    setRemoving(false);
  };

  const isProcessing = adding || removing;

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0">
        <div className="flex h-full max-h-[85vh] flex-col">
          {/* ヘッダー */}
          <div className="border-b bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-white">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <span className="text-slate-800">{user?.name || user?.email}</span>
                  <span className="ml-2 text-slate-400">の受講講座</span>
                </div>
              </DialogTitle>
              <DialogDescription className="mt-2 pl-[52px] text-slate-500">
                講座をクリックして登録・解除できます
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* メッセージエリア */}
          {(error || successMessage) && (
            <div className="px-6 pt-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {successMessage}
                </div>
              )}
            </div>
          )}

          {/* コンテンツ */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-6">
              {/* 登録済み講座 */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-600">
                      {enrolledCourses.length}
                    </span>
                    登録済み
                  </h3>
                  {enrolledCourses.length > 0 && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllToRemove}
                        disabled={selectedToRemove.size === enrolledCourses.length || isProcessing}
                        className="text-xs font-medium text-red-600 hover:text-red-700 disabled:text-slate-300"
                      >
                        すべて選択
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={handleDeselectAllToRemove}
                        disabled={selectedToRemove.size === 0 || isProcessing}
                        className="text-xs font-medium text-slate-500 hover:text-slate-700 disabled:text-slate-300"
                      >
                        選択解除
                      </button>
                    </div>
                  )}
                </div>
                {enrolledCourses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-8 text-center">
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                      <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-500">まだ登録されている講座はありません</p>
                    <p className="text-xs text-slate-400">下の講座をクリックして登録してください</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {enrolledCourses.map((course) => (
                      <EnrolledCourseCard
                        key={course.id}
                        course={course}
                        isSelected={selectedToRemove.has(course.id)}
                        isProcessing={isProcessing}
                        onToggle={() => handleToggleToRemove(course.id)}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* 未登録講座 */}
              {availableCourses.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                        {availableCourses.length}
                      </span>
                      未登録
                    </h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllToAdd}
                        disabled={selectedToAdd.size === availableCourses.length || isProcessing}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-slate-300"
                      >
                        すべて選択
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={handleDeselectAllToAdd}
                        disabled={selectedToAdd.size === 0 || isProcessing}
                        className="text-xs font-medium text-slate-500 hover:text-slate-700 disabled:text-slate-300"
                      >
                        選択解除
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {availableCourses.map((course) => (
                      <AvailableCourseCard
                        key={course.id}
                        course={course}
                        isSelected={selectedToAdd.has(course.id)}
                        onToggle={() => handleToggleToAdd(course.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* 全て登録済みメッセージ */}
              {availableCourses.length === 0 && enrolledCourses.length > 0 && (
                <div className="flex items-center justify-center rounded-xl bg-slate-50 py-6 text-center">
                  <p className="text-sm text-slate-500">
                    すべての講座が登録済みです
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* フッター */}
          <div className="flex items-center justify-between border-t bg-slate-50 px-6 py-4">
            <div className="flex items-center gap-4 text-sm text-slate-500">
              {selectedToRemove.size > 0 && (
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                    {selectedToRemove.size}
                  </span>
                  件を解除
                </span>
              )}
              {selectedToAdd.size > 0 && (
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                    {selectedToAdd.size}
                  </span>
                  件を登録
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} disabled={isProcessing}>
                閉じる
              </Button>
              {selectedToRemove.size > 0 && (
                <Button
                  onClick={handleBulkRemove}
                  disabled={isProcessing}
                  variant="destructive"
                >
                  {removing ? (
                    <>
                      <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      解除中...
                    </>
                  ) : (
                    <>
                      <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {selectedToRemove.size}件を解除
                    </>
                  )}
                </Button>
              )}
              {selectedToAdd.size > 0 && (
                <Button
                  onClick={handleBulkAdd}
                  disabled={isProcessing}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {adding ? (
                    <>
                      <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      登録中...
                    </>
                  ) : (
                    <>
                      <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {selectedToAdd.size}件を登録
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
