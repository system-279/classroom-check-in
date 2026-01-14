export type Enrollment = {
  id: string;
  courseId: string;
  userId: string;
  role: "student" | "teacher";
  startAt?: string;
  endAt?: string | null;
  createdAt?: string;
};

export type EnrollmentInput = {
  courseId: string;
  userId: string;
  role?: "student" | "teacher";
  startAt?: string;
  endAt?: string | null;
};
