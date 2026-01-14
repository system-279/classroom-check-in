"use client";

import { useState } from "react";
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
import type { User } from "@/types/user";
import type { Course } from "@/types/course";
import type { Enrollment } from "@/types/enrollment";
import type { Session } from "@/types/session";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";

type Props = {
  users: User[];
  courses: Course[];
  enrollments: Enrollment[];
  openSessions: Session[];
  onEdit: (user: User) => void;
  onEnrollments: (user: User) => void;
  onDelete: () => void;
};

export function UserTable({ users, courses, enrollments, openSessions, onEdit, onEnrollments, onDelete }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const getEnrollmentCount = (userId: string) => {
    return enrollments.filter((e) => e.userId === userId).length;
  };

  const getOpenSessionCount = (userId: string) => {
    return openSessions.filter((s) => s.userId === userId).length;
  };

  const getEnrolledCourseNames = (userId: string) => {
    const userEnrollments = enrollments.filter((e) => e.userId === userId);
    return userEnrollments
      .map((e) => courses.find((c) => c.id === e.courseId)?.name)
      .filter(Boolean)
      .slice(0, 3);
  };

  if (users.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        ユーザーがいません
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名前</TableHead>
              <TableHead>メールアドレス</TableHead>
              <TableHead className="w-24 text-center">ロール</TableHead>
              <TableHead>受講講座</TableHead>
              <TableHead className="w-20 text-center">未退室</TableHead>
              <TableHead className="w-48">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.name || <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {user.email}
                </TableCell>
                <TableCell className="text-center">
                  <RoleBadge role={user.role} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {getEnrolledCourseNames(user.id).map((name, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                    {getEnrollmentCount(user.id) > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{getEnrollmentCount(user.id) - 3}
                      </Badge>
                    )}
                    {getEnrollmentCount(user.id) === 0 && (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {getOpenSessionCount(user.id) > 0 ? (
                    <Badge variant="destructive" className="text-xs">
                      {getOpenSessionCount(user.id)}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEnrollments(user)}
                    >
                      講座
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(user)}
                    >
                      編集
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteTarget(user)}
                    >
                      削除
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DeleteConfirmDialog
        user={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={onDelete}
      />
    </>
  );
}

function RoleBadge({ role }: { role: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    admin: { label: "管理者", className: "bg-red-100 text-red-800" },
    teacher: { label: "講師", className: "bg-blue-100 text-blue-800" },
    student: { label: "受講者", className: "bg-green-100 text-green-800" },
  };

  const { label, className } = variants[role] ?? { label: role, className: "" };

  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
