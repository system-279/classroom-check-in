export type SessionSummary = {
  lastSessionAt: string | null;
  totalDurationSec: number;
  sessionCount: number;
  hasActiveSession: boolean;
};

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
  sessionSummary?: SessionSummary;
};

export type CourseInput = {
  name: string;
  description?: string | null;
  classroomUrl?: string | null;
  enabled?: boolean;
  visible?: boolean;
  note?: string | null;
};
