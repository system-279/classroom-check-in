/**
 * エンティティの型定義
 * DataSource抽象化のための共通型
 */

export type UserRole = "admin" | "teacher" | "student";
export type SessionStatus = "open" | "closed";
export type NotificationScope = "global" | "course" | "user";

export interface Course {
  id: string;
  name: string;
  description: string | null;
  classroomUrl: string | null;
  requiredWatchMin: number; // 必要視聴時間（分）。デフォルト63
  enabled: boolean;
  visible: boolean;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  firebaseUid?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Enrollment {
  id: string;
  courseId: string;
  userId: string;
  role: string;
  startAt: Date;
  endAt: Date | null;
  createdAt: Date;
}

export interface Session {
  id: string;
  courseId: string;
  userId: string;
  startTime: Date;
  endTime: Date | null;
  durationSec: number;
  source: string;
  confidence: number | null;
  status: SessionStatus;
  lastHeartbeatAt: Date | null;
}

export interface NotificationPolicy {
  id: string;
  scope: NotificationScope;
  courseId: string | null;
  userId: string | null;
  firstNotifyAfterMin: number;
  repeatIntervalHours: number;
  maxRepeatDays: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AllowedEmail {
  id: string;
  email: string;
  note: string | null;
  createdAt: Date;
}

export interface UserSettings {
  userId: string;
  notificationEnabled: boolean;
  timezone: string;
  updatedAt: Date;
}

export interface AuthErrorLog {
  id: string;
  email: string;
  tenantId: string;
  errorType: string;
  errorMessage: string;
  path: string;
  method: string;
  userAgent: string | null;
  ipAddress: string | null;
  occurredAt: Date;
}
