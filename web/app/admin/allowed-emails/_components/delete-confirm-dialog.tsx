"use client";

import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthFetch } from "@/lib/auth-fetch-context";
import type { AllowedEmail } from "@/types/allowed-email";

type Props = {
  allowedEmail: AllowedEmail;
  onSuccess: () => void;
  trigger: ReactNode;
};

export function DeleteConfirmDialog({ allowedEmail, onSuccess, trigger }: Props) {
  const authFetch = useAuthFetch();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      await authFetch(`/api/v1/admin/allowed-emails/${allowedEmail.id}`, {
        method: "DELETE",
      });
      setOpen(false);
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>許可を削除</DialogTitle>
          <DialogDescription>
            「{allowedEmail.email}」の許可を削除しますか？
            このメールアドレスのユーザーは新規ログインできなくなります。
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
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
