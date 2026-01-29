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
import type { User } from "@/types/user";

type Props = {
  user: User | null;
  onClose: () => void;
  onDeleted: () => void;
};

/**
 * APIエラーレスポンスを解析して、ユーザーフレンドリーなメッセージを返す
 */
function parseDeleteError(errorMessage: string): string {
  // APIからの "Cannot delete user: X session(s) exist" 形式を解析
  const sessionMatch = errorMessage.match(/(\d+)\s*session\(s\)\s*exist/i);
  if (sessionMatch) {
    const count = parseInt(sessionMatch[1], 10);
    return `このユーザーには ${count} 件のセッションが存在するため削除できません。先にセッションを削除してください。`;
  }

  // "Cannot delete user: X enrollment(s) exist" 形式を解析
  const enrollmentMatch = errorMessage.match(/(\d+)\s*enrollment\(s\)\s*exist/i);
  if (enrollmentMatch) {
    const count = parseInt(enrollmentMatch[1], 10);
    return `このユーザーには ${count} 件の受講登録が存在するため削除できません。先に受講登録を解除してください。`;
  }

  // その他のエラー
  return errorMessage || "削除に失敗しました";
}

export function DeleteConfirmDialog({ user, onClose, onDeleted }: Props) {
  const authFetch = useAuthFetch();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!user) return;

    setDeleting(true);
    setError(null);

    try {
      await authFetch(`/api/v1/admin/users/${user.id}`, {
        method: "DELETE",
      });
      onClose();
      onDeleted();
    } catch (e) {
      const rawMessage = e instanceof Error ? e.message : "削除に失敗しました";
      setError(parseDeleteError(rawMessage));
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
            関連する受講登録も一緒に削除されます。この操作は取り消せません。
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
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
