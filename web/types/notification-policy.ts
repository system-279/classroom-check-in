export type PolicyScope = "global" | "course" | "user";

export type NotificationPolicy = {
  id: string;
  scope: PolicyScope;
  courseId: string | null;
  userId: string | null;
  firstNotifyAfterMin: number;
  repeatIntervalHours: number;
  maxRepeatDays: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type NotificationPolicyInput = {
  scope: PolicyScope;
  courseId?: string | null;
  userId?: string | null;
  firstNotifyAfterMin?: number;
  repeatIntervalHours?: number;
  maxRepeatDays?: number;
  active?: boolean;
};
