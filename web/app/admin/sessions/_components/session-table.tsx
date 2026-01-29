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
import type { Session } from "@/types/session";
import type { Course } from "@/types/course";
import type { User } from "@/types/user";

type Props = {
  sessions: Session[];
  courses: Course[];
  users: User[];
  onClose: (session: Session) => void;
  onDelete?: (session: Session) => void; // ADR-0026: セッション削除（リセット）
};

export function SessionTable({ sessions, courses, users, onClose, onDelete }: Props) {
  const getCourseName = (courseId: string) => {
    return courses.find((c) => c.id === courseId)?.name ?? courseId;
  };

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user?.name || user?.email || userId;
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return "-";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}時間${minutes}分`;
    }
    return `${minutes}分`;
  };

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        セッションがありません
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ユーザー</TableHead>
            <TableHead>講座</TableHead>
            <TableHead>開始</TableHead>
            <TableHead>終了</TableHead>
            <TableHead className="text-right">滞在時間</TableHead>
            <TableHead className="w-24 text-center">状態</TableHead>
            <TableHead className="w-24">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => (
            <TableRow key={session.id}>
              <TableCell className="font-medium">
                {getUserName(session.userId)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {getCourseName(session.courseId)}
              </TableCell>
              <TableCell className="text-sm">
                {formatDateTime(session.startTime)}
              </TableCell>
              <TableCell className="text-sm">
                {formatDateTime(session.endTime)}
              </TableCell>
              <TableCell className="text-right text-sm">
                {formatDuration(session.durationSec)}
              </TableCell>
              <TableCell className="text-center">
                <StatusBadge status={session.status} />
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {session.status === "open" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onClose(session)}
                    >
                      終了
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onDelete(session)}
                    >
                      削除
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    open: { label: "継続中", variant: "default" },
    closed: { label: "終了", variant: "secondary" },
    adjusted: { label: "補正済", variant: "outline" },
  };

  const { label, variant } = variants[status] ?? { label: status, variant: "outline" as const };

  return (
    <Badge variant={variant}>
      {label}
    </Badge>
  );
}
