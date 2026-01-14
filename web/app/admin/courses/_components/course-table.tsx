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
import type { Course } from "@/types/course";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";

type Props = {
  courses: Course[];
  onEdit: (course: Course) => void;
  onDelete: () => void;
};

export function CourseTable({ courses, onEdit, onDelete }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);

  if (courses.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        講座がありません
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>講座名</TableHead>
              <TableHead>Classroom URL</TableHead>
              <TableHead className="w-24 text-center">有効</TableHead>
              <TableHead className="w-24 text-center">表示</TableHead>
              <TableHead className="w-32">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((course) => (
              <TableRow key={course.id}>
                <TableCell className="font-medium">{course.name}</TableCell>
                <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                  {course.classroomUrl || "-"}
                </TableCell>
                <TableCell className="text-center">
                  <StatusBadge active={course.enabled} />
                </TableCell>
                <TableCell className="text-center">
                  <StatusBadge active={course.visible} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(course)}
                    >
                      編集
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteTarget(course)}
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
        course={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={onDelete}
      />
    </>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        active ? "bg-green-500" : "bg-gray-300"
      }`}
    />
  );
}
