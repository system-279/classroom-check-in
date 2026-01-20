/**
 * デモモード用のインメモリモックデータ
 * 本番Firestoreには一切書き込まない
 */

export const demoCourses = [
  {
    id: "demo-course-1",
    name: "プログラミング基礎",
    description: "プログラミングの基本概念を学ぶ入門講座",
    classroomUrl: "https://classroom.google.com/c/demo1",
    requiredWatchMin: 63,
    enabled: true,
    visible: true,
    note: "デモ用講座",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  },
  {
    id: "demo-course-2",
    name: "Web開発入門",
    description: "HTML/CSS/JavaScriptの基礎",
    classroomUrl: "https://classroom.google.com/c/demo2",
    requiredWatchMin: 90,
    enabled: true,
    visible: true,
    note: "デモ用講座",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  },
  {
    id: "demo-course-3",
    name: "データサイエンス入門",
    description: "Pythonを使ったデータ分析の基礎",
    classroomUrl: "https://classroom.google.com/c/demo3",
    requiredWatchMin: 120,
    enabled: true,
    visible: false,
    note: "デモ用講座（非表示）",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  },
];

export const demoUsers = [
  {
    id: "demo-admin",
    email: "admin@demo.example.com",
    name: "管理者デモ",
    role: "admin",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  },
  {
    id: "demo-teacher",
    email: "teacher@demo.example.com",
    name: "講師デモ",
    role: "teacher",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  },
  {
    id: "demo-student-1",
    email: "student1@demo.example.com",
    name: "受講者A",
    role: "student",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  },
  {
    id: "demo-student-2",
    email: "student2@demo.example.com",
    name: "受講者B",
    role: "student",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  },
];

export const demoEnrollments = [
  {
    id: "demo-enrollment-1",
    courseId: "demo-course-1",
    userId: "demo-student-1",
    role: "student",
    startAt: new Date("2024-01-01T00:00:00Z"),
    endAt: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
  },
  {
    id: "demo-enrollment-2",
    courseId: "demo-course-1",
    userId: "demo-student-2",
    role: "student",
    startAt: new Date("2024-01-01T00:00:00Z"),
    endAt: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
  },
  {
    id: "demo-enrollment-3",
    courseId: "demo-course-2",
    userId: "demo-student-1",
    role: "student",
    startAt: new Date("2024-01-01T00:00:00Z"),
    endAt: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
  },
];

export const demoSessions = [
  {
    id: "demo-session-1",
    courseId: "demo-course-1",
    userId: "demo-student-1",
    startTime: new Date("2024-01-15T09:00:00Z"),
    endTime: new Date("2024-01-15T10:30:00Z"),
    durationSec: 5400,
    source: "manual",
    confidence: null,
    status: "closed",
    lastHeartbeatAt: new Date("2024-01-15T10:29:00Z"),
  },
  {
    id: "demo-session-2",
    courseId: "demo-course-1",
    userId: "demo-student-2",
    startTime: new Date("2024-01-15T09:05:00Z"),
    endTime: null,
    durationSec: 0,
    source: "manual",
    confidence: null,
    status: "open",
    lastHeartbeatAt: new Date("2024-01-15T11:00:00Z"),
  },
  {
    id: "demo-session-3",
    courseId: "demo-course-2",
    userId: "demo-student-1",
    startTime: new Date("2024-01-14T14:00:00Z"),
    endTime: new Date("2024-01-14T15:00:00Z"),
    durationSec: 3600,
    source: "manual",
    confidence: null,
    status: "closed",
    lastHeartbeatAt: new Date("2024-01-14T14:59:00Z"),
  },
];

export const demoNotificationPolicies = [
  {
    id: "demo-policy-global",
    scope: "global",
    courseId: null,
    userId: null,
    firstNotifyAfterMin: 60,
    repeatIntervalHours: 24,
    maxRepeatDays: 7,
    active: true,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  },
  {
    id: "demo-policy-course",
    scope: "course",
    courseId: "demo-course-1",
    userId: null,
    firstNotifyAfterMin: 30,
    repeatIntervalHours: 12,
    maxRepeatDays: 3,
    active: true,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  },
];

export const demoAllowedEmails = [
  {
    id: "demo-allowed-1",
    email: "admin@demo.example.com",
    note: "デモ管理者",
    createdAt: new Date("2024-01-01T00:00:00Z"),
  },
  {
    id: "demo-allowed-2",
    email: "teacher@demo.example.com",
    note: "デモ講師",
    createdAt: new Date("2024-01-01T00:00:00Z"),
  },
  {
    id: "demo-allowed-3",
    email: "student1@demo.example.com",
    note: "デモ受講者1",
    createdAt: new Date("2024-01-01T00:00:00Z"),
  },
];

// ヘルパー関数: DateをISO文字列に変換
export function toISOStringOrNull(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}
