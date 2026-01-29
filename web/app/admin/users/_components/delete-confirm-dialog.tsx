"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthFetch } from "@/lib/auth-fetch-context";
import { ApiError } from "@/lib/api";
import type { User } from "@/types/user";

type Props = {
  user: User | null;
  onClose: () => void;
  onDeleted: () => void;
};

type DeleteErrorDetails = {
  sessionCount: number;
  enrollmentCount: number;
} | null;

export function DeleteConfirmDialog({ user, onClose, onDeleted }: Props) {
  const authFetch = useAuthFetch();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<DeleteErrorDetails>(null);

  const handleDelete = async () => {
    if (!user) return;

    setDeleting(true);
    setError(null);
    setErrorDetails(null);

    try {
      await authFetch(`/api/v1/admin/users/${user.id}`, {
        method: "DELETE",
      });
      onClose();
      onDeleted();
    } catch (e) {
      if (e instanceof ApiError && e.code === "has_related_data" && e.details) {
        setErrorDetails({
          sessionCount: (e.details.sessionCount as number) ?? 0,
          enrollmentCount: (e.details.enrollmentCount as number) ?? 0,
        });
        setError("関連データが存在するため削除できません");
      } else {
        setError(e instanceof Error ? e.message : "削除に失敗しました");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ユーザーを削除</DialogTitle>
          <DialogDescription>
            「{user?.name || user?.email}」を削除しますか？
            この操作は取り消せません。
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-4 text-sm">
            <p className="font-medium text-destructive">{error}</p>
            {errorDetails && (
              <div className="mt-3 space-y-2 text-muted-foreground">
                {errorDetails.sessionCount > 0 && (
                  <p>
                    ・セッション: <span className="font-medium text-foreground">{errorDetails.sessionCount}件</span>
                    <span className="ml-2 text-xs">（セッション管理で削除してください）</span>
                  </p>
                )}
                {errorDetails.enrollmentCount > 0 && (
                  <p>
                    ・受講登録: <span className="font-medium text-foreground">{errorDetails.enrollmentCount}件</span>
                    <span className="ml-2 text-xs">（受講者一覧から登録解除してください）</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            キャンセル
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "削除中..." : "削除"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
