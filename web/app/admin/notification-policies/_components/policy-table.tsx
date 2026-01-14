"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { NotificationPolicy } from "@/types/notification-policy";
import type { Course } from "@/types/course";
import type { User } from "@/types/user";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { useState } from "react";

type Props = {
  policies: NotificationPolicy[];
  courses: Course[];
  users: User[];
  onEdit: (policy: NotificationPolicy) => void;
  onDelete: () => void;
};

const scopeLabels: Record<string, string> = {
  global: "グローバル",
  course: "講座",
  user: "ユーザー",
};

export function PolicyTable({ policies, courses, users, onEdit, onDelete }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<NotificationPolicy | null>(null);

  const getCourseName = (courseId: string | null) => {
    if (!courseId) return "-";
    const course = courses.find((c) => c.id === courseId);
    return course?.name ?? courseId;
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return "-";
    const user = users.find((u) => u.id === userId);
    return user?.name ?? user?.email ?? userId;
  };

  if (policies.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        通知ポリシーがありません
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>スコープ</TableHead>
            <TableHead>対象</TableHead>
            <TableHead>初回通知</TableHead>
            <TableHead>再通知間隔</TableHead>
            <TableHead>最大日数</TableHead>
            <TableHead>状態</TableHead>
            <TableHead className="w-[100px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {policies.map((policy) => (
            <TableRow key={policy.id}>
              <TableCell>
                <Badge variant="outline">{scopeLabels[policy.scope]}</Badge>
              </TableCell>
              <TableCell>
                {policy.scope === "course" && getCourseName(policy.courseId)}
                {policy.scope === "user" && getUserName(policy.userId)}
                {policy.scope === "global" && "-"}
              </TableCell>
              <TableCell>{policy.firstNotifyAfterMin}分後</TableCell>
              <TableCell>{policy.repeatIntervalHours}時間</TableCell>
              <TableCell>{policy.maxRepeatDays}日</TableCell>
              <TableCell>
                <Badge variant={policy.active ? "default" : "secondary"}>
                  {policy.active ? "有効" : "無効"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(policy)}
                  >
                    編集
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(policy)}
                  >
                    削除
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        policy={deleteTarget}
        onSuccess={() => {
          setDeleteTarget(null);
          onDelete();
        }}
      />
    </>
  );
}
