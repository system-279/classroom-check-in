/**
 * FirestoreDataSource
 * 本番用のFirestoreデータソース実装
 */

import { Firestore, FieldValue, Timestamp } from "@google-cloud/firestore";
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
import type {
  Course,
  User,
  Enrollment,
  Session,
  NotificationPolicy,
  AllowedEmail,
  UserSettings,
} from "../types/entities.js";

// Firestore Timestampを Date に変換
function toDate(timestamp: Timestamp | Date | null | undefined): Date {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp.toDate === "function") return timestamp.toDate();
  return new Date();
}

function toDateOrNull(timestamp: Timestamp | Date | null | undefined): Date | null {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp.toDate === "function") return timestamp.toDate();
  return null;
}

export class FirestoreDataSource implements DataSource {
  private db: Firestore;
  private tenantPath: string;
  readonly tenantId: string;

  /**
   * @param db Firestoreインスタンス
   * @param tenantId テナントID（必須）- 空文字列の場合はレガシーモード（ルート直下）
   */
  constructor(db: Firestore, tenantId: string) {
    if (tenantId === undefined || tenantId === null) {
      throw new Error("tenantId is required for FirestoreDataSource");
    }
    this.db = db;
    this.tenantId = tenantId;
    // tenantIdが空文字列の場合はレガシーモード（既存データとの互換性）
    // 空でない場合は tenants/{tenantId}/ プレフィックスを使用
    this.tenantPath = tenantId ? `tenants/${tenantId}/` : "";
  }

  private collection(name: string) {
    return this.db.collection(`${this.tenantPath}${name}`);
  }

  // Courses
  async getCourses(filter?: CourseFilter): Promise<Course[]> {
    let query = this.collection("courses").orderBy("createdAt", "desc");

    if (filter?.enabled !== undefined) {
      query = query.where("enabled", "==", filter.enabled);
    }
    if (filter?.visible !== undefined) {
      query = query.where("visible", "==", filter.visible);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => this.toCourse(doc.id, doc.data()));
  }

  async getCourseById(id: string): Promise<Course | null> {
    const doc = await this.collection("courses").doc(id).get();
    if (!doc.exists) return null;
    return this.toCourse(doc.id, doc.data()!);
  }

  async createCourse(data: Omit<Course, "id" | "createdAt" | "updatedAt">): Promise<Course> {
    const docRef = this.collection("courses").doc();
    const now = FieldValue.serverTimestamp();
    await docRef.set({
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    const doc = await docRef.get();
    return this.toCourse(doc.id, doc.data()!);
  }

  async updateCourse(id: string, data: CourseUpdateData): Promise<Course | null> {
    const docRef = this.collection("courses").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return null;

    await docRef.update({
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    });
    const updated = await docRef.get();
    return this.toCourse(updated.id, updated.data()!);
  }

  async deleteCourse(id: string): Promise<boolean> {
    const docRef = this.collection("courses").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return false;
    await docRef.delete();
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toCourse(id: string, data: any): Course {
    return {
      id,
      name: data.name,
      description: data.description ?? null,
      classroomUrl: data.classroomUrl ?? null,
      requiredWatchMin: data.requiredWatchMin ?? 63, // デフォルト63分（1時間3分）
      enabled: data.enabled ?? true,
      visible: data.visible ?? true,
      note: data.note ?? null,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    };
  }

  // Users
  async getUsers(): Promise<User[]> {
    const snapshot = await this.collection("users").orderBy("createdAt", "desc").get();
    return snapshot.docs.map((doc) => this.toUser(doc.id, doc.data()));
  }

  async getUserById(id: string): Promise<User | null> {
    const doc = await this.collection("users").doc(id).get();
    if (!doc.exists) return null;
    return this.toUser(doc.id, doc.data()!);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const snapshot = await this.collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return this.toUser(doc.id, doc.data());
  }

  async getUserByFirebaseUid(uid: string): Promise<User | null> {
    const snapshot = await this.collection("users")
      .where("firebaseUid", "==", uid)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return this.toUser(doc.id, doc.data());
  }

  async createUser(data: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    const docRef = this.collection("users").doc();
    const now = FieldValue.serverTimestamp();
    await docRef.set({
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    const doc = await docRef.get();
    return this.toUser(doc.id, doc.data()!);
  }

  async updateUser(id: string, data: UserUpdateData): Promise<User | null> {
    const docRef = this.collection("users").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return null;

    await docRef.update({
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    });
    const updated = await docRef.get();
    return this.toUser(updated.id, updated.data()!);
  }

  async deleteUser(id: string): Promise<boolean> {
    const docRef = this.collection("users").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return false;
    await docRef.delete();
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toUser(id: string, data: any): User {
    return {
      id,
      email: data.email,
      name: data.name ?? null,
      role: data.role ?? "student",
      firebaseUid: data.firebaseUid,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    };
  }

  // Enrollments
  async getEnrollments(filter?: EnrollmentFilter): Promise<Enrollment[]> {
    let query = this.collection("enrollments").orderBy("createdAt", "desc");

    if (filter?.courseId) {
      query = query.where("courseId", "==", filter.courseId);
    }
    if (filter?.userId) {
      query = query.where("userId", "==", filter.userId);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => this.toEnrollment(doc.id, doc.data()));
  }

  async getEnrollmentById(id: string): Promise<Enrollment | null> {
    const doc = await this.collection("enrollments").doc(id).get();
    if (!doc.exists) return null;
    return this.toEnrollment(doc.id, doc.data()!);
  }

  async createEnrollment(data: Omit<Enrollment, "id" | "createdAt">): Promise<Enrollment> {
    const docRef = this.collection("enrollments").doc();
    await docRef.set({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    return this.toEnrollment(doc.id, doc.data()!);
  }

  async updateEnrollment(id: string, data: EnrollmentUpdateData): Promise<Enrollment | null> {
    const docRef = this.collection("enrollments").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return null;

    await docRef.update(data);
    const updated = await docRef.get();
    return this.toEnrollment(updated.id, updated.data()!);
  }

  async deleteEnrollment(id: string): Promise<boolean> {
    const docRef = this.collection("enrollments").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return false;
    await docRef.delete();
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toEnrollment(id: string, data: any): Enrollment {
    return {
      id,
      courseId: data.courseId,
      userId: data.userId,
      role: data.role ?? "student",
      startAt: toDate(data.startAt),
      endAt: toDateOrNull(data.endAt),
      createdAt: toDate(data.createdAt),
    };
  }

  // Sessions
  async getSessions(filter?: SessionFilter): Promise<Session[]> {
    let query = this.collection("sessions").orderBy("startTime", "desc");

    if (filter?.courseId) {
      query = query.where("courseId", "==", filter.courseId);
    }
    if (filter?.userId) {
      query = query.where("userId", "==", filter.userId);
    }
    if (filter?.status) {
      query = query.where("status", "==", filter.status);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => this.toSession(doc.id, doc.data()));
  }

  async getSessionById(id: string): Promise<Session | null> {
    const doc = await this.collection("sessions").doc(id).get();
    if (!doc.exists) return null;
    return this.toSession(doc.id, doc.data()!);
  }

  async getActiveSession(userId: string, courseId?: string): Promise<Session | null> {
    let query = this.collection("sessions")
      .where("userId", "==", userId)
      .where("status", "==", "open");

    if (courseId) {
      query = query.where("courseId", "==", courseId);
    }

    const snapshot = await query.limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return this.toSession(doc.id, doc.data());
  }

  async createSession(data: Omit<Session, "id">): Promise<Session> {
    const docRef = this.collection("sessions").doc();
    await docRef.set({
      ...data,
      startTime: Timestamp.fromDate(data.startTime),
      endTime: data.endTime ? Timestamp.fromDate(data.endTime) : null,
      lastHeartbeatAt: data.lastHeartbeatAt ? Timestamp.fromDate(data.lastHeartbeatAt) : null,
    });
    const doc = await docRef.get();
    return this.toSession(doc.id, doc.data()!);
  }

  async updateSession(id: string, data: SessionUpdateData): Promise<Session | null> {
    const docRef = this.collection("sessions").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { ...data };
    delete updateData.id;

    // Date を Timestamp に変換
    if (data.startTime) updateData.startTime = Timestamp.fromDate(data.startTime);
    if (data.endTime) updateData.endTime = Timestamp.fromDate(data.endTime);
    if (data.lastHeartbeatAt) updateData.lastHeartbeatAt = Timestamp.fromDate(data.lastHeartbeatAt);

    await docRef.update(updateData);
    const updated = await docRef.get();
    return this.toSession(updated.id, updated.data()!);
  }

  async deleteSession(id: string): Promise<boolean> {
    const docRef = this.collection("sessions").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return false;
    await docRef.delete();
    return true;
  }

  async checkInOrGetExisting(
    userId: string,
    courseId: string,
    sessionData: Omit<Session, "id">,
  ): Promise<{ session: Session; isExisting: boolean }> {
    const sessionsRef = this.collection("sessions");

    return this.db.runTransaction(async (transaction) => {
      // トランザクション内で既存セッションを確認
      const existingSnapshot = await transaction.get(
        sessionsRef
          .where("userId", "==", userId)
          .where("courseId", "==", courseId)
          .where("status", "==", "open")
          .limit(1),
      );

      if (!existingSnapshot.empty) {
        const doc = existingSnapshot.docs[0];
        return {
          session: this.toSession(doc.id, doc.data()),
          isExisting: true,
        };
      }

      // 新規セッション作成
      const newDocRef = sessionsRef.doc();
      transaction.set(newDocRef, {
        ...sessionData,
        startTime: Timestamp.fromDate(sessionData.startTime),
        endTime: sessionData.endTime ? Timestamp.fromDate(sessionData.endTime) : null,
        lastHeartbeatAt: sessionData.lastHeartbeatAt
          ? Timestamp.fromDate(sessionData.lastHeartbeatAt)
          : null,
      });

      return {
        session: {
          id: newDocRef.id,
          ...sessionData,
        },
        isExisting: false,
      };
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toSession(id: string, data: any): Session {
    return {
      id,
      courseId: data.courseId,
      userId: data.userId,
      startTime: toDate(data.startTime),
      endTime: toDateOrNull(data.endTime),
      durationSec: data.durationSec ?? 0,
      source: data.source ?? "manual",
      confidence: data.confidence ?? null,
      status: data.status ?? "open",
      lastHeartbeatAt: toDateOrNull(data.lastHeartbeatAt),
    };
  }

  // Notification Policies
  async getNotificationPolicies(filter?: NotificationPolicyFilter): Promise<NotificationPolicy[]> {
    let query = this.collection("notification_policies").orderBy("createdAt", "desc");

    if (filter?.scope) {
      query = query.where("scope", "==", filter.scope);
    }
    if (filter?.courseId) {
      query = query.where("courseId", "==", filter.courseId);
    }
    if (filter?.userId) {
      query = query.where("userId", "==", filter.userId);
    }
    if (filter?.active !== undefined) {
      query = query.where("active", "==", filter.active);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => this.toNotificationPolicy(doc.id, doc.data()));
  }

  async getNotificationPolicyById(id: string): Promise<NotificationPolicy | null> {
    const doc = await this.collection("notification_policies").doc(id).get();
    if (!doc.exists) return null;
    return this.toNotificationPolicy(doc.id, doc.data()!);
  }

  async createNotificationPolicy(
    data: Omit<NotificationPolicy, "id" | "createdAt" | "updatedAt">
  ): Promise<NotificationPolicy> {
    const docRef = this.collection("notification_policies").doc();
    const now = FieldValue.serverTimestamp();
    await docRef.set({
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    const doc = await docRef.get();
    return this.toNotificationPolicy(doc.id, doc.data()!);
  }

  async updateNotificationPolicy(
    id: string,
    data: NotificationPolicyUpdateData
  ): Promise<NotificationPolicy | null> {
    const docRef = this.collection("notification_policies").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return null;

    await docRef.update({
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    });
    const updated = await docRef.get();
    return this.toNotificationPolicy(updated.id, updated.data()!);
  }

  async deleteNotificationPolicy(id: string): Promise<boolean> {
    const docRef = this.collection("notification_policies").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return false;
    await docRef.delete();
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toNotificationPolicy(id: string, data: any): NotificationPolicy {
    return {
      id,
      scope: data.scope ?? "global",
      courseId: data.courseId ?? null,
      userId: data.userId ?? null,
      firstNotifyAfterMin: data.firstNotifyAfterMin ?? 60,
      repeatIntervalHours: data.repeatIntervalHours ?? 24,
      maxRepeatDays: data.maxRepeatDays ?? 7,
      active: data.active ?? true,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    };
  }

  // Allowed Emails
  async getAllowedEmails(): Promise<AllowedEmail[]> {
    const snapshot = await this.collection("allowed_emails").orderBy("createdAt", "desc").get();
    return snapshot.docs.map((doc) => this.toAllowedEmail(doc.id, doc.data()));
  }

  async getAllowedEmailById(id: string): Promise<AllowedEmail | null> {
    const doc = await this.collection("allowed_emails").doc(id).get();
    if (!doc.exists) return null;
    return this.toAllowedEmail(doc.id, doc.data()!);
  }

  async isEmailAllowed(email: string): Promise<boolean> {
    const snapshot = await this.collection("allowed_emails")
      .where("email", "==", email)
      .limit(1)
      .get();
    return !snapshot.empty;
  }

  async createAllowedEmail(data: Omit<AllowedEmail, "id" | "createdAt">): Promise<AllowedEmail> {
    const docRef = this.collection("allowed_emails").doc();
    await docRef.set({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    return this.toAllowedEmail(doc.id, doc.data()!);
  }

  async deleteAllowedEmail(id: string): Promise<boolean> {
    const docRef = this.collection("allowed_emails").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return false;
    await docRef.delete();
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toAllowedEmail(id: string, data: any): AllowedEmail {
    return {
      id,
      email: data.email,
      note: data.note ?? null,
      createdAt: toDate(data.createdAt),
    };
  }

  // User Settings
  async getUserSettings(userId: string): Promise<UserSettings | null> {
    const doc = await this.collection("user_settings").doc(userId).get();
    if (!doc.exists) return null;
    return this.toUserSettings(userId, doc.data()!);
  }

  async upsertUserSettings(userId: string, data: Partial<UserSettings>): Promise<UserSettings> {
    const docRef = this.collection("user_settings").doc(userId);
    const doc = await docRef.get();

    if (doc.exists) {
      await docRef.update({
        ...data,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      await docRef.set({
        notificationEnabled: data.notificationEnabled ?? true,
        timezone: data.timezone ?? "Asia/Tokyo",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const updated = await docRef.get();
    return this.toUserSettings(userId, updated.data()!);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toUserSettings(userId: string, data: any): UserSettings {
    return {
      userId,
      notificationEnabled: data.notificationEnabled ?? true,
      timezone: data.timezone ?? "Asia/Tokyo",
      updatedAt: toDate(data.updatedAt),
    };
  }
}
