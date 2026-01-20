/**
 * DataSource インターフェース
 * Firestore と InMemory の両方で実装される抽象化レイヤー
 */

import type {
  Course,
  User,
  Enrollment,
  Session,
  NotificationPolicy,
  AllowedEmail,
  UserSettings,
} from "../types/entities.js";

export interface CourseFilter {
  enabled?: boolean;
  visible?: boolean;
}

export interface SessionFilter {
  courseId?: string;
  userId?: string;
  status?: "open" | "closed";
}

export interface EnrollmentFilter {
  courseId?: string;
  userId?: string;
}

export interface NotificationPolicyFilter {
  scope?: "global" | "course" | "user";
  courseId?: string;
  userId?: string;
  active?: boolean;
}

/**
 * 更新用の型定義
 * イミュータブルフィールド（id, createdAt, updatedAt）を除外
 */
export type CourseUpdateData = Partial<Omit<Course, "id" | "createdAt" | "updatedAt">>;
export type UserUpdateData = Partial<Omit<User, "id" | "createdAt" | "updatedAt">>;
export type EnrollmentUpdateData = Partial<Omit<Enrollment, "id" | "createdAt">>;
export type SessionUpdateData = Partial<Omit<Session, "id">>;
export type NotificationPolicyUpdateData = Partial<Omit<NotificationPolicy, "id" | "createdAt" | "updatedAt">>;

/**
 * DataSource インターフェース
 * テナント単位でインスタンス化される
 */
export interface DataSource {
  // Courses
  getCourses(filter?: CourseFilter): Promise<Course[]>;
  getCourseById(id: string): Promise<Course | null>;
  createCourse(data: Omit<Course, "id" | "createdAt" | "updatedAt">): Promise<Course>;
  updateCourse(id: string, data: CourseUpdateData): Promise<Course | null>;
  deleteCourse(id: string): Promise<boolean>;

  // Users
  getUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByFirebaseUid(uid: string): Promise<User | null>;
  createUser(data: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User>;
  updateUser(id: string, data: UserUpdateData): Promise<User | null>;
  deleteUser(id: string): Promise<boolean>;

  // Enrollments
  getEnrollments(filter?: EnrollmentFilter): Promise<Enrollment[]>;
  getEnrollmentById(id: string): Promise<Enrollment | null>;
  createEnrollment(data: Omit<Enrollment, "id" | "createdAt">): Promise<Enrollment>;
  updateEnrollment(id: string, data: EnrollmentUpdateData): Promise<Enrollment | null>;
  deleteEnrollment(id: string): Promise<boolean>;

  // Sessions
  getSessions(filter?: SessionFilter): Promise<Session[]>;
  getSessionById(id: string): Promise<Session | null>;
  getActiveSession(userId: string, courseId?: string): Promise<Session | null>;
  createSession(data: Omit<Session, "id">): Promise<Session>;
  updateSession(id: string, data: SessionUpdateData): Promise<Session | null>;
  deleteSession(id: string): Promise<boolean>;
  /**
   * アトミックなチェックイン操作
   * 既存のオープンセッションがあればそれを返し、なければ新規作成
   * 同時リクエストによる重複作成を防止
   */
  checkInOrGetExisting(
    userId: string,
    courseId: string,
    sessionData: Omit<Session, "id">,
  ): Promise<{ session: Session; isExisting: boolean }>;

  // Notification Policies
  getNotificationPolicies(filter?: NotificationPolicyFilter): Promise<NotificationPolicy[]>;
  getNotificationPolicyById(id: string): Promise<NotificationPolicy | null>;
  createNotificationPolicy(data: Omit<NotificationPolicy, "id" | "createdAt" | "updatedAt">): Promise<NotificationPolicy>;
  updateNotificationPolicy(id: string, data: NotificationPolicyUpdateData): Promise<NotificationPolicy | null>;
  deleteNotificationPolicy(id: string): Promise<boolean>;

  // Allowed Emails
  getAllowedEmails(): Promise<AllowedEmail[]>;
  getAllowedEmailById(id: string): Promise<AllowedEmail | null>;
  isEmailAllowed(email: string): Promise<boolean>;
  createAllowedEmail(data: Omit<AllowedEmail, "id" | "createdAt">): Promise<AllowedEmail>;
  deleteAllowedEmail(id: string): Promise<boolean>;

  // User Settings
  getUserSettings(userId: string): Promise<UserSettings | null>;
  upsertUserSettings(userId: string, data: Partial<UserSettings>): Promise<UserSettings>;

  // Notification Logs
  /**
   * セッションに対する通知ログを取得
   * @param sessionId セッションID
   * @returns 送信済み通知情報、または存在しない場合はnull
   */
  getNotificationLog(sessionId: string): Promise<{
    sentAt: Date;
    type: string;
  } | null>;
}

/**
 * 読み取り専用DataSource（デモモード用）
 * 書き込み操作は例外をスロー
 */
export class ReadOnlyDataSourceError extends Error {
  constructor() {
    super("This data source is read-only");
    this.name = "ReadOnlyDataSourceError";
  }
}
