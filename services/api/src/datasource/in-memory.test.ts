/**
 * InMemoryDataSource のユニットテスト
 *
 * テスト対象:
 * - CRUD操作
 * - フィルタリング
 * - 読み取り専用モード
 * - checkInOrGetExisting（ADR-0012）
 */

import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryDataSource } from "./in-memory.js";
import { ReadOnlyDataSourceError } from "./interface.js";

describe("InMemoryDataSource", () => {
  describe("読み取り専用モード（デフォルト）", () => {
    let ds: InMemoryDataSource;

    beforeEach(() => {
      ds = new InMemoryDataSource({ readOnly: true });
    });

    it("コースを取得できる", async () => {
      const courses = await ds.getCourses();
      expect(courses.length).toBeGreaterThan(0);
      expect(courses[0]).toHaveProperty("id");
      expect(courses[0]).toHaveProperty("name");
    });

    it("コースをフィルタできる（enabled）", async () => {
      const enabledCourses = await ds.getCourses({ enabled: true });
      expect(enabledCourses.every((c) => c.enabled === true)).toBe(true);
    });

    it("コースをフィルタできる（visible）", async () => {
      const visibleCourses = await ds.getCourses({ visible: true });
      expect(visibleCourses.every((c) => c.visible === true)).toBe(true);

      const hiddenCourses = await ds.getCourses({ visible: false });
      expect(hiddenCourses.every((c) => c.visible === false)).toBe(true);
    });

    it("IDでコースを取得できる", async () => {
      const course = await ds.getCourseById("demo-course-1");
      expect(course).not.toBeNull();
      expect(course?.id).toBe("demo-course-1");
    });

    it("存在しないコースはnullを返す", async () => {
      const course = await ds.getCourseById("non-existent");
      expect(course).toBeNull();
    });

    it("書き込み操作は ReadOnlyDataSourceError を投げる", async () => {
      await expect(
        ds.createCourse({
          name: "Test",
          description: "Test",
          classroomUrl: "https://example.com",
          requiredWatchMin: 60,
          enabled: true,
          visible: true,
          note: null,
        })
      ).rejects.toThrow(ReadOnlyDataSourceError);

      await expect(
        ds.updateCourse("demo-course-1", { name: "Updated" })
      ).rejects.toThrow(ReadOnlyDataSourceError);

      await expect(ds.deleteCourse("demo-course-1")).rejects.toThrow(
        ReadOnlyDataSourceError
      );
    });
  });

  describe("書き込み可能モード", () => {
    let ds: InMemoryDataSource;

    beforeEach(() => {
      ds = new InMemoryDataSource({ readOnly: false });
    });

    describe("Courses", () => {
      it("コースを作成できる", async () => {
        const course = await ds.createCourse({
          name: "New Course",
          description: "Test description",
          classroomUrl: "https://example.com",
          requiredWatchMin: 60,
          enabled: true,
          visible: true,
          note: null,
        });

        expect(course.id).toBeDefined();
        expect(course.name).toBe("New Course");
        expect(course.createdAt).toBeInstanceOf(Date);
      });

      it("コースを更新できる", async () => {
        const updated = await ds.updateCourse("demo-course-1", {
          name: "Updated Name",
        });

        expect(updated).not.toBeNull();
        expect(updated?.name).toBe("Updated Name");
        expect(updated?.updatedAt).toBeInstanceOf(Date);
      });

      it("存在しないコースの更新はnullを返す", async () => {
        const updated = await ds.updateCourse("non-existent", {
          name: "Updated",
        });
        expect(updated).toBeNull();
      });

      it("コースを削除できる", async () => {
        const deleted = await ds.deleteCourse("demo-course-1");
        expect(deleted).toBe(true);

        const course = await ds.getCourseById("demo-course-1");
        expect(course).toBeNull();
      });

      it("存在しないコースの削除はfalseを返す", async () => {
        const deleted = await ds.deleteCourse("non-existent");
        expect(deleted).toBe(false);
      });
    });

    describe("Users", () => {
      it("ユーザーを取得できる", async () => {
        const users = await ds.getUsers();
        expect(users.length).toBeGreaterThan(0);
      });

      it("メールアドレスでユーザーを取得できる", async () => {
        const user = await ds.getUserByEmail("admin@demo.example.com");
        expect(user).not.toBeNull();
        expect(user?.email).toBe("admin@demo.example.com");
      });

      it("ユーザーを作成できる", async () => {
        const user = await ds.createUser({
          email: "new@example.com",
          name: "New User",
          role: "student",
        });

        expect(user.id).toBeDefined();
        expect(user.email).toBe("new@example.com");
      });

      it("ユーザーを更新できる", async () => {
        const updated = await ds.updateUser("demo-admin", {
          name: "Updated Admin",
        });

        expect(updated).not.toBeNull();
        expect(updated?.name).toBe("Updated Admin");
      });

      it("ユーザーを削除できる", async () => {
        const deleted = await ds.deleteUser("demo-student-2");
        expect(deleted).toBe(true);

        const user = await ds.getUserById("demo-student-2");
        expect(user).toBeNull();
      });
    });

    describe("Enrollments", () => {
      it("受講登録をフィルタできる（courseId）", async () => {
        const enrollments = await ds.getEnrollments({
          courseId: "demo-course-1",
        });
        expect(enrollments.every((e) => e.courseId === "demo-course-1")).toBe(
          true
        );
      });

      it("受講登録をフィルタできる（userId）", async () => {
        const enrollments = await ds.getEnrollments({
          userId: "demo-student-1",
        });
        expect(enrollments.every((e) => e.userId === "demo-student-1")).toBe(
          true
        );
      });

      it("受講登録を作成できる", async () => {
        const enrollment = await ds.createEnrollment({
          courseId: "demo-course-2",
          userId: "demo-student-2",
          role: "student",
          startAt: new Date(),
          endAt: null,
        });

        expect(enrollment.id).toBeDefined();
        expect(enrollment.courseId).toBe("demo-course-2");
      });

      it("受講登録を更新できる", async () => {
        const updated = await ds.updateEnrollment("demo-enrollment-1", {
          endAt: new Date(),
        });

        expect(updated).not.toBeNull();
        expect(updated?.endAt).toBeInstanceOf(Date);
      });

      it("受講登録を削除できる", async () => {
        const deleted = await ds.deleteEnrollment("demo-enrollment-1");
        expect(deleted).toBe(true);
      });
    });

    describe("Sessions", () => {
      it("セッションをフィルタできる（status）", async () => {
        const openSessions = await ds.getSessions({ status: "open" });
        expect(openSessions.every((s) => s.status === "open")).toBe(true);
      });

      it("アクティブセッションを取得できる", async () => {
        const session = await ds.getActiveSession("demo-student-2");
        expect(session).not.toBeNull();
        expect(session?.status).toBe("open");
      });

      it("アクティブセッションがない場合はnullを返す", async () => {
        const session = await ds.getActiveSession("demo-student-1");
        expect(session).toBeNull();
      });

      it("セッションを作成できる", async () => {
        const session = await ds.createSession({
          courseId: "demo-course-1",
          userId: "demo-student-1",
          startTime: new Date(),
          endTime: null,
          durationSec: 0,
          source: "manual",
          confidence: null,
          status: "open",
          lastHeartbeatAt: new Date(),
        });

        expect(session.id).toBeDefined();
        expect(session.status).toBe("open");
      });

      it("セッションを更新できる", async () => {
        const updated = await ds.updateSession("demo-session-2", {
          status: "closed",
          endTime: new Date(),
        });

        expect(updated).not.toBeNull();
        expect(updated?.status).toBe("closed");
      });

      it("セッションを削除できる", async () => {
        const deleted = await ds.deleteSession("demo-session-1");
        expect(deleted).toBe(true);
      });
    });

    describe("checkInOrGetExisting（ADR-0012）", () => {
      it("既存のオープンセッションがあれば返す", async () => {
        const result = await ds.checkInOrGetExisting(
          "demo-student-2",
          "demo-course-1",
          {
            courseId: "demo-course-1",
            userId: "demo-student-2",
            startTime: new Date(),
            endTime: null,
            durationSec: 0,
            source: "manual",
            confidence: null,
            status: "open",
            lastHeartbeatAt: new Date(),
          }
        );

        expect(result.isExisting).toBe(true);
        expect(result.session.id).toBe("demo-session-2");
      });

      it("オープンセッションがなければ新規作成", async () => {
        const result = await ds.checkInOrGetExisting(
          "demo-student-1",
          "demo-course-2",
          {
            courseId: "demo-course-2",
            userId: "demo-student-1",
            startTime: new Date(),
            endTime: null,
            durationSec: 0,
            source: "manual",
            confidence: null,
            status: "open",
            lastHeartbeatAt: new Date(),
          }
        );

        expect(result.isExisting).toBe(false);
        expect(result.session.courseId).toBe("demo-course-2");
        expect(result.session.userId).toBe("demo-student-1");
      });
    });

    describe("Notification Policies", () => {
      it("ポリシーをフィルタできる（scope）", async () => {
        const globalPolicies = await ds.getNotificationPolicies({
          scope: "global",
        });
        expect(globalPolicies.every((p) => p.scope === "global")).toBe(true);
      });

      it("ポリシーを作成できる", async () => {
        const policy = await ds.createNotificationPolicy({
          scope: "user",
          courseId: null,
          userId: "demo-student-1",
          firstNotifyAfterMin: 90,
          repeatIntervalHours: 48,
          maxRepeatDays: 14,
          active: true,
        });

        expect(policy.id).toBeDefined();
        expect(policy.scope).toBe("user");
      });

      it("ポリシーを更新できる", async () => {
        const updated = await ds.updateNotificationPolicy("demo-policy-global", {
          firstNotifyAfterMin: 120,
        });

        expect(updated).not.toBeNull();
        expect(updated?.firstNotifyAfterMin).toBe(120);
      });

      it("ポリシーを削除できる", async () => {
        const deleted = await ds.deleteNotificationPolicy("demo-policy-course");
        expect(deleted).toBe(true);
      });
    });

    describe("Allowed Emails", () => {
      it("許可メールを取得できる", async () => {
        const emails = await ds.getAllowedEmails();
        expect(emails.length).toBeGreaterThan(0);
      });

      it("メールが許可されているか確認できる", async () => {
        const allowed = await ds.isEmailAllowed("admin@demo.example.com");
        expect(allowed).toBe(true);

        const notAllowed = await ds.isEmailAllowed("unknown@example.com");
        expect(notAllowed).toBe(false);
      });

      it("許可メールを追加できる", async () => {
        const email = await ds.createAllowedEmail({
          email: "new@example.com",
          note: "Test",
        });

        expect(email.id).toBeDefined();
        expect(email.email).toBe("new@example.com");
      });

      it("許可メールを削除できる", async () => {
        const deleted = await ds.deleteAllowedEmail("demo-allowed-3");
        expect(deleted).toBe(true);
      });
    });

    describe("User Settings", () => {
      it("ユーザー設定を取得できる（未設定の場合はnull）", async () => {
        const settings = await ds.getUserSettings("demo-student-1");
        expect(settings).toBeNull();
      });

      it("ユーザー設定を作成/更新できる", async () => {
        const settings = await ds.upsertUserSettings("demo-student-1", {
          notificationEnabled: false,
          timezone: "America/New_York",
        });

        expect(settings.userId).toBe("demo-student-1");
        expect(settings.notificationEnabled).toBe(false);
        expect(settings.timezone).toBe("America/New_York");
      });

      it("既存設定を更新できる", async () => {
        // 初回作成
        await ds.upsertUserSettings("demo-student-1", {
          notificationEnabled: true,
        });

        // 更新
        const updated = await ds.upsertUserSettings("demo-student-1", {
          timezone: "Europe/London",
        });

        expect(updated.notificationEnabled).toBe(true); // 前回の値を維持
        expect(updated.timezone).toBe("Europe/London");
      });
    });

    describe("Notification Logs", () => {
      it("デモモードでは常にnullを返す", async () => {
        const log = await ds.getNotificationLog("any-session-id");
        expect(log).toBeNull();
      });
    });
  });
});
