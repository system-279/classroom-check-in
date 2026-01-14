"use client";

import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { Course } from "@/types/course";

type Props = {
  course: Course;
};

export function CourseCard({ course }: Props) {
  return (
    <Link href={`/student/session/${course.id}`}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">{course.name}</CardTitle>
          {course.description && (
            <CardDescription className="line-clamp-2">
              {course.description}
            </CardDescription>
          )}
        </CardHeader>
        {course.classroomUrl && (
          <CardContent>
            <span className="text-xs text-muted-foreground">
              Google Classroom連携あり
            </span>
          </CardContent>
        )}
      </Card>
    </Link>
  );
}
