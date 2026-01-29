"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthFetch } from "@/lib/auth-fetch-context";
import type {
  NotificationPolicy,
  NotificationPolicyInput,
  PolicyScope,
} from "@/types/notification-policy";
import type { Course } from "@/types/course";
import type { User } from "@/types/user";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy: NotificationPolicy | null;
  courses: Course[];
  users: User[];
  onSuccess: () => void;
};

export function PolicyFormDialog({
  open,
  onOpenChange,
  policy,
  courses,
  users,
  onSuccess,
}: Props) {
  const authFetch = useAuthFetch();
  const [scope, setScope] = useState<PolicyScope>("global");
  const [courseId, setCourseId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [firstNotifyAfterMin, setFirstNotifyAfterMin] = useState(60);
  const [repeatIntervalHours, setRepeatIntervalHours] = useState(24);
  const [maxRepeatDays, setMaxRepeatDays] = useState(7);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!policy;

  useEffect(() => {
    if (open) {
      if (policy) {
        setScope(policy.scope);
        setCourseId(policy.courseId ?? "");
        setUserId(policy.userId ?? "");
        setFirstNotifyAfterMin(policy.firstNotifyAfterMin);
        setRepeatIntervalHours(policy.repeatIntervalHours);
        setMaxRepeatDays(policy.maxRepeatDays);
        setActive(policy.active);
      } else {
        setScope("global");
        setCourseId("");
        setUserId("");
        setFirstNotifyAfterMin(60);
        setRepeatIntervalHours(24);
        setMaxRepeatDays(7);
        setActive(true);
      }
      setError(null);
    }
  }, [open, policy]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: NotificationPolicyInput = {
      scope,
      courseId: scope === "course" ? courseId : null,
      userId: scope === "user" ? userId : null,
      firstNotifyAfterMin,
      repeatIntervalHours,
      maxRepeatDays,
      active,
    };

    try {
      if (isEditing) {
        await authFetch(`/api/v1/admin/notification-policies/${policy.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            firstNotifyAfterMin,
            repeatIntervalHours,
            maxRepeatDays,
            active,
          }),
        });
      } else {
        await authFetch("/api/v1/admin/notification-policies", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "通知ポリシーを編集" : "新規通知ポリシー"}
          </DialogTitle>
          <DialogDescription>
            OUT忘れ通知のタイミングと繰り返し設定を行います
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="scope">スコープ *</Label>
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as PolicyScope)}
              disabled={isEditing}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">グローバル</SelectItem>
                <SelectItem value="course">講座</SelectItem>
                <SelectItem value="user">ユーザー</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              グローバル &lt; 講座 &lt; ユーザー の順で優先されます
            </p>
          </div>

          {scope === "course" && (
            <div className="space-y-2">
              <Label htmlFor="courseId">対象講座 *</Label>
              <Select
                value={courseId}
                onValueChange={setCourseId}
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="講座を選択" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {scope === "user" && (
            <div className="space-y-2">
              <Label htmlFor="userId">対象ユーザー *</Label>
              <Select
                value={userId}
                onValueChange={setUserId}
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="ユーザーを選択" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name ?? user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="firstNotifyAfterMin">初回通知までの時間（分）</Label>
            <Input
              id="firstNotifyAfterMin"
              type="number"
              min={1}
              value={firstNotifyAfterMin}
              onChange={(e) => setFirstNotifyAfterMin(Number(e.target.value))}
            />
            <p className="text-sm text-muted-foreground">
              最終heartbeatからこの時間が経過したら通知を送信
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="repeatIntervalHours">再通知間隔（時間）</Label>
            <Input
              id="repeatIntervalHours"
              type="number"
              min={1}
              value={repeatIntervalHours}
              onChange={(e) => setRepeatIntervalHours(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxRepeatDays">最大繰り返し日数</Label>
            <Input
              id="maxRepeatDays"
              type="number"
              min={1}
              value={maxRepeatDays}
              onChange={(e) => setMaxRepeatDays(Number(e.target.value))}
            />
            <p className="text-sm text-muted-foreground">
              この日数を超えると再通知を停止
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="active">有効</Label>
              <p className="text-sm text-muted-foreground">
                このポリシーを適用するかどうか
              </p>
            </div>
            <Switch id="active" checked={active} onCheckedChange={setActive} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
