/**
 * InMemoryDataSource
 * デモモード用のインメモリデータソース実装
 */

import type {
  DataSource,
  CourseFilter,
  SessionFilter,
  EnrollmentFilter,
  NotificationPolicyFilter,
  CourseUpdateData,
  UserUpdateData,
  EnrollmentUpdateData,
  SessionUpdateData,
  NotificationPolicyUpdateData,
} from "./interface.js";
import { ReadOnlyDataSourceError } from "./interface.js";
import type {
  Course,
  User,
  Enrollment,
  Session,
  NotificationPolicy,
  AllowedEmail,
  UserSettings,
} from "../types/entities.js";

// デモ用初期データ
const initialCourses: Course[] = [
  {
    id: "demo-course-1",
    name: "プログラミング基礎",
    description: "プログラミングの基本概念を学ぶ入門講座",
    classroomUrl: "https://classroom.google.com/c/demo1",
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
    enabled: true,
    visible: false,
    note: "デモ用講座（非表示）",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  },
];

const initialUsers: User[] = [
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

const initialEnrollments: Enrollment[] = [
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

const initialSessions: Session[] = [
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

const initialNotificationPolicies: NotificationPolicy[] = [
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

const initialAllowedEmails: AllowedEmail[] = [
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

export class InMemoryDataSource implements DataSource {
  private courses: Course[] = [...initialCourses];
  private users: User[] = [...initialUsers];
  private enrollments: Enrollment[] = [...initialEnrollments];
  private sessions: Session[] = [...initialSessions];
  private notificationPolicies: NotificationPolicy[] = [...initialNotificationPolicies];
  private allowedEmails: AllowedEmail[] = [...initialAllowedEmails];
  private userSettings: Map<string, UserSettings> = new Map();

  private readonly readOnly: boolean;

  constructor(options: { readOnly?: boolean } = {}) {
    this.readOnly = options.readOnly ?? true;
  }

  private throwIfReadOnly(): void {
    if (this.readOnly) {
      throw new ReadOnlyDataSourceError();
    }
  }

  // Courses
  async getCourses(filter?: CourseFilter): Promise<Course[]> {
    let result = [...this.courses];
    if (filter?.enabled !== undefined) {
      result = result.filter((c) => c.enabled === filter.enabled);
    }
    if (filter?.visible !== undefined) {
      result = result.filter((c) => c.visible === filter.visible);
    }
    return result;
  }

  async getCourseById(id: string): Promise<Course | null> {
    return this.courses.find((c) => c.id === id) ?? null;
  }

  async createCourse(data: Omit<Course, "id" | "createdAt" | "updatedAt">): Promise<Course> {
    this.throwIfReadOnly();
    const course: Course = {
      ...data,
      id: `course-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.courses.push(course);
    return course;
  }

  async updateCourse(id: string, data: CourseUpdateData): Promise<Course | null> {
    this.throwIfReadOnly();
    const index = this.courses.findIndex((c) => c.id === id);
    if (index === -1) return null;
    this.courses[index] = { ...this.courses[index], ...data, updatedAt: new Date() };
    return this.courses[index];
  }

  async deleteCourse(id: string): Promise<boolean> {
    this.throwIfReadOnly();
    const index = this.courses.findIndex((c) => c.id === id);
    if (index === -1) return false;
    this.courses.splice(index, 1);
    return true;
  }

  // Users
  async getUsers(): Promise<User[]> {
    return [...this.users];
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async getUserByFirebaseUid(uid: string): Promise<User | null> {
    return this.users.find((u) => u.firebaseUid === uid) ?? null;
  }

  async createUser(data: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    this.throwIfReadOnly();
    const user: User = {
      ...data,
      id: `user-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(user);
    return user;
  }

  async updateUser(id: string, data: UserUpdateData): Promise<User | null> {
    this.throwIfReadOnly();
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) return null;
    this.users[index] = { ...this.users[index], ...data, updatedAt: new Date() };
    return this.users[index];
  }

  async deleteUser(id: string): Promise<boolean> {
    this.throwIfReadOnly();
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) return false;
    this.users.splice(index, 1);
    return true;
  }

  // Enrollments
  async getEnrollments(filter?: EnrollmentFilter): Promise<Enrollment[]> {
    let result = [...this.enrollments];
    if (filter?.courseId) {
      result = result.filter((e) => e.courseId === filter.courseId);
    }
    if (filter?.userId) {
      result = result.filter((e) => e.userId === filter.userId);
    }
    return result;
  }

  async getEnrollmentById(id: string): Promise<Enrollment | null> {
    return this.enrollments.find((e) => e.id === id) ?? null;
  }

  async createEnrollment(data: Omit<Enrollment, "id" | "createdAt">): Promise<Enrollment> {
    this.throwIfReadOnly();
    const enrollment: Enrollment = {
      ...data,
      id: `enrollment-${Date.now()}`,
      createdAt: new Date(),
    };
    this.enrollments.push(enrollment);
    return enrollment;
  }

  async updateEnrollment(id: string, data: EnrollmentUpdateData): Promise<Enrollment | null> {
    this.throwIfReadOnly();
    const index = this.enrollments.findIndex((e) => e.id === id);
    if (index === -1) return null;
    this.enrollments[index] = { ...this.enrollments[index], ...data };
    return this.enrollments[index];
  }

  async deleteEnrollment(id: string): Promise<boolean> {
    this.throwIfReadOnly();
    const index = this.enrollments.findIndex((e) => e.id === id);
    if (index === -1) return false;
    this.enrollments.splice(index, 1);
    return true;
  }

  // Sessions
  async getSessions(filter?: SessionFilter): Promise<Session[]> {
    let result = [...this.sessions];
    if (filter?.courseId) {
      result = result.filter((s) => s.courseId === filter.courseId);
    }
    if (filter?.userId) {
      result = result.filter((s) => s.userId === filter.userId);
    }
    if (filter?.status) {
      result = result.filter((s) => s.status === filter.status);
    }
    return result;
  }

  async getSessionById(id: string): Promise<Session | null> {
    return this.sessions.find((s) => s.id === id) ?? null;
  }

  async getActiveSession(userId: string, courseId?: string): Promise<Session | null> {
    return (
      this.sessions.find(
        (s) =>
          s.userId === userId &&
          s.status === "open" &&
          (!courseId || s.courseId === courseId)
      ) ?? null
    );
  }

  async createSession(data: Omit<Session, "id">): Promise<Session> {
    this.throwIfReadOnly();
    const session: Session = {
      ...data,
      id: `session-${Date.now()}`,
    };
    this.sessions.push(session);
    return session;
  }

  async updateSession(id: string, data: SessionUpdateData): Promise<Session | null> {
    this.throwIfReadOnly();
    const index = this.sessions.findIndex((s) => s.id === id);
    if (index === -1) return null;
    this.sessions[index] = { ...this.sessions[index], ...data };
    return this.sessions[index];
  }

  async deleteSession(id: string): Promise<boolean> {
    this.throwIfReadOnly();
    const index = this.sessions.findIndex((s) => s.id === id);
    if (index === -1) return false;
    this.sessions.splice(index, 1);
    return true;
  }

  // Notification Policies
  async getNotificationPolicies(filter?: NotificationPolicyFilter): Promise<NotificationPolicy[]> {
    let result = [...this.notificationPolicies];
    if (filter?.scope) {
      result = result.filter((p) => p.scope === filter.scope);
    }
    if (filter?.courseId) {
      result = result.filter((p) => p.courseId === filter.courseId);
    }
    if (filter?.userId) {
      result = result.filter((p) => p.userId === filter.userId);
    }
    if (filter?.active !== undefined) {
      result = result.filter((p) => p.active === filter.active);
    }
    return result;
  }

  async getNotificationPolicyById(id: string): Promise<NotificationPolicy | null> {
    return this.notificationPolicies.find((p) => p.id === id) ?? null;
  }

  async createNotificationPolicy(
    data: Omit<NotificationPolicy, "id" | "createdAt" | "updatedAt">
  ): Promise<NotificationPolicy> {
    this.throwIfReadOnly();
    const policy: NotificationPolicy = {
      ...data,
      id: `policy-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.notificationPolicies.push(policy);
    return policy;
  }

  async updateNotificationPolicy(
    id: string,
    data: NotificationPolicyUpdateData
  ): Promise<NotificationPolicy | null> {
    this.throwIfReadOnly();
    const index = this.notificationPolicies.findIndex((p) => p.id === id);
    if (index === -1) return null;
    this.notificationPolicies[index] = {
      ...this.notificationPolicies[index],
      ...data,
      updatedAt: new Date(),
    };
    return this.notificationPolicies[index];
  }

  async deleteNotificationPolicy(id: string): Promise<boolean> {
    this.throwIfReadOnly();
    const index = this.notificationPolicies.findIndex((p) => p.id === id);
    if (index === -1) return false;
    this.notificationPolicies.splice(index, 1);
    return true;
  }

  // Allowed Emails
  async getAllowedEmails(): Promise<AllowedEmail[]> {
    return [...this.allowedEmails];
  }

  async getAllowedEmailById(id: string): Promise<AllowedEmail | null> {
    return this.allowedEmails.find((e) => e.id === id) ?? null;
  }

  async isEmailAllowed(email: string): Promise<boolean> {
    return this.allowedEmails.some((e) => e.email === email);
  }

  async createAllowedEmail(data: Omit<AllowedEmail, "id" | "createdAt">): Promise<AllowedEmail> {
    this.throwIfReadOnly();
    const allowedEmail: AllowedEmail = {
      ...data,
      id: `allowed-${Date.now()}`,
      createdAt: new Date(),
    };
    this.allowedEmails.push(allowedEmail);
    return allowedEmail;
  }

  async deleteAllowedEmail(id: string): Promise<boolean> {
    this.throwIfReadOnly();
    const index = this.allowedEmails.findIndex((e) => e.id === id);
    if (index === -1) return false;
    this.allowedEmails.splice(index, 1);
    return true;
  }

  // User Settings
  async getUserSettings(userId: string): Promise<UserSettings | null> {
    return this.userSettings.get(userId) ?? null;
  }

  async upsertUserSettings(userId: string, data: Partial<UserSettings>): Promise<UserSettings> {
    this.throwIfReadOnly();
    const existing = this.userSettings.get(userId);
    const settings: UserSettings = {
      userId,
      notificationEnabled: data.notificationEnabled ?? existing?.notificationEnabled ?? true,
      timezone: data.timezone ?? existing?.timezone ?? "Asia/Tokyo",
      updatedAt: new Date(),
    };
    this.userSettings.set(userId, settings);
    return settings;
  }
}
