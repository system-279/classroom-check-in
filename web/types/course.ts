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
  requiredWatchMin: number; // 必要視聴時間（分）。デフォルト63
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
  requiredWatchMin?: number; // 必要視聴時間（分）
  enabled?: boolean;
  visible?: boolean;
  note?: string | null;
};
