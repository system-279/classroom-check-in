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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import type { Session } from "@/types/session";
import type { Course } from "@/types/course";
import type { User } from "@/types/user";

type Props = {
  session: Session | null;
  courses: Course[];
  users: User[];
  onClose: () => void;
  onSuccess: () => void;
};

export function CloseSessionDialog({
  session,
  courses,
  users,
  onClose,
  onSuccess,
}: Props) {
  const [closedAt, setClosedAt] = useState("");
  const [reason, setReason] = useState("");
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCourseName = (courseId: string) => {
    return courses.find((c) => c.id === courseId)?.name ?? courseId;
  };

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user?.name || user?.email || userId;
  };

  const handleClose = async () => {
    if (!session) return;

    setClosing(true);
    setError(null);

    try {
      await apiFetch(`/api/v1/admin/sessions/${session.id}/close`, {
        method: "POST",
        body: JSON.stringify({
          closedAt: closedAt || undefined,
          reason: reason || "admin_close",
        }),
      });
      onClose();
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "終了に失敗しました");
    } finally {
      setClosing(false);
    }
  };

  return (
    <Dialog open={!!session} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>セッションを終了</DialogTitle>
          <DialogDescription>
            {session && (
              <>
                {getUserName(session.userId)} の「{getCourseName(session.courseId)}」
                セッションを強制終了します。
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="closedAt">終了時刻（空欄で現在時刻）</Label>
            <Input
              id="closedAt"
              type="datetime-local"
              value={closedAt}
              onChange={(e) => setClosedAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">理由</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例: OUT忘れの補正"
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={closing}>
            キャンセル
          </Button>
          <Button onClick={handleClose} disabled={closing}>
            {closing ? "処理中..." : "終了する"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
