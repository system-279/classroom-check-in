export type User = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "teacher" | "student";
  createdAt?: string;
  updatedAt?: string;
};

export type UserInput = {
  email: string;
  name?: string | null;
  role?: "admin" | "teacher" | "student";
};
