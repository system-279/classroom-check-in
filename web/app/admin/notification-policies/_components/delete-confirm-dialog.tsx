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
import type { NotificationPolicy } from "@/types/notification-policy";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy: NotificationPolicy | null;
  onSuccess: () => void;
};

const scopeLabels: Record<string, string> = {
  global: "グローバル",
  course: "講座",
  user: "ユーザー",
};

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  policy,
  onSuccess,
}: Props) {
  const authFetch = useAuthFetch();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!policy) return;

    setDeleting(true);
    setError(null);

    try {
      await authFetch(`/api/v1/admin/notification-policies/${policy.id}`, {
        method: "DELETE",
      });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>通知ポリシーを削除</DialogTitle>
          <DialogDescription>
            {policy && (
              <>
                スコープ「{scopeLabels[policy.scope]}」の通知ポリシーを削除しますか？
                この操作は取り消せません。
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            キャンセル
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "削除中..." : "削除"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
