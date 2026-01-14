export interface Session {
  id: string;
  courseId: string;
  userId: string;
  startTime: Date;
  endTime: Date | null;
  lastHeartbeatAt: Date;
  status: "open" | "closed" | "adjusted";
}

export type PolicyScope = "global" | "course" | "user";

export interface NotificationPolicy {
  id: string;
  scope: PolicyScope;
  courseId?: string;
  userId?: string;
  firstNotifyAfterMin: number;
  repeatIntervalHours: number;
  maxRepeatDays: number;
  active: boolean;
}

export type NotificationType = "out_missing";
export type NotificationChannel = "email";
export type NotificationStatus = "sent" | "failed";

export interface NotificationLog {
  id: string;
  userId: string;
  courseId: string;
  sessionId: string;
  type: NotificationType;
  channel: NotificationChannel;
  sentAt: Date;
  status: NotificationStatus;
  error?: string;
}

export interface UserSettings {
  id: string;
  userId: string;
  notifyEmail: string;
  notifyEnabled: boolean;
  timezone?: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface Course {
  id: string;
  name: string;
}

export interface NotificationTarget {
  session: Session;
  user: User;
  userSettings: UserSettings;
  course: Course;
  policy: NotificationPolicy;
}

export interface RunResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}
