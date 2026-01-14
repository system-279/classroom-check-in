export type Course = {
  id: string;
  name: string;
  description: string | null;
  classroomUrl: string | null;
  enabled: boolean;
  visible: boolean;
  note: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CourseInput = {
  name: string;
  description?: string | null;
  classroomUrl?: string | null;
  enabled?: boolean;
  visible?: boolean;
  note?: string | null;
};
