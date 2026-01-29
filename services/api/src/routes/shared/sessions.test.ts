/**
 * sessions.ts のユニットテスト
 *
 * テスト対象:
 * - check-in: 受講登録の確認、同時セッション禁止（ADR-0023）
 * - check-out: 必要視聴時間の確認
 * - self-checkout: 通知送信済み確認、時刻バリデーション
 * - heartbeat: セッション所有者確認
 * - admin/sessions/close: 強制終了
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import express from "express";
import request from "supertest";

// vi.hoisted でモック関数をホイスト前に定義
const mockDataSource = vi.hoisted(() => ({
  getActiveSession: vi.fn(),
  getSessionById: vi.fn(),
  getSessions: vi.fn(),
  getCourseById: vi.fn(),
  getEnrollments: vi.fn(),
  checkInOrGetExisting: vi.fn(),
  updateSession: vi.fn(),
  getNotificationLog: vi.fn(),
}));

// モック設定
vi.mock("../../middleware/auth.js", () => ({
  requireUser: (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "unauthorized" });
    }
    next();
  },
  requireAdmin: (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "unauthorized" });
    }
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  },
}));

// テスト用アプリ作成ヘルパー
async function createTestApp(user?: { id: string; role: string }) {
  const { sessionsRouter } = await import("./sessions.js");

  const app = express();
  app.use(express.json());

  // ユーザーとDataSourceをセット
  app.use((req, _res, next) => {
    if (user) {
      req.user = user as Express.Request["user"];
    }
    req.dataSource = mockDataSource as unknown as Express.Request["dataSource"];
    next();
  });

  app.use("/", sessionsRouter);
  return app;
}

describe("sessions router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /sessions/active", () => {
    it("アクティブセッションがない場合はnullを返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });
      mockDataSource.getActiveSession.mockResolvedValue(null);

      const res = await request(app).get("/sessions/active");

      expect(res.status).toBe(200);
      expect(res.body.session).toBeNull();
    });

    it("アクティブセッションがある場合はフォーマットして返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });
      const session = {
        id: "session-1",
        courseId: "course-1",
        userId: "user-1",
        startTime: new Date("2026-01-29T10:00:00Z"),
        endTime: null,
        durationSec: 0,
        source: "manual",
        confidence: null,
        status: "open",
        lastHeartbeatAt: new Date("2026-01-29T10:00:00Z"),
      };
      mockDataSource.getActiveSession.mockResolvedValue(session);

      const res = await request(app).get("/sessions/active");

      expect(res.status).toBe(200);
      expect(res.body.session).toEqual({
        id: "session-1",
        courseId: "course-1",
        userId: "user-1",
        startTime: "2026-01-29T10:00:00.000Z",
        endTime: null,
        durationSec: 0,
        source: "manual",
        confidence: null,
        status: "open",
        lastHeartbeatAt: "2026-01-29T10:00:00.000Z",
      });
    });

    it("未認証の場合は401を返す", async () => {
      const app = await createTestApp(); // ユーザーなし

      const res = await request(app).get("/sessions/active");

      expect(res.status).toBe(401);
    });
  });

  describe("POST /sessions/check-in", () => {
    it("courseIdがない場合は400を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });

      const res = await request(app).post("/sessions/check-in").send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_course_id");
    });

    it("存在しない講座の場合は404を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });
      mockDataSource.getCourseById.mockResolvedValue(null);

      const res = await request(app).post("/sessions/check-in").send({ courseId: "invalid" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("course_not_found");
    });

    it("無効な講座の場合は404を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });
      mockDataSource.getCourseById.mockResolvedValue({ id: "course-1", enabled: false, visible: true });

      const res = await request(app).post("/sessions/check-in").send({ courseId: "course-1" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("course_not_found");
    });

    it("受講登録がない場合は403を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });
      mockDataSource.getCourseById.mockResolvedValue({ id: "course-1", enabled: true, visible: true });
      mockDataSource.getEnrollments.mockResolvedValue([]);

      const res = await request(app).post("/sessions/check-in").send({ courseId: "course-1" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("not_enrolled");
    });

    it("別講座で既にセッションがある場合は409を返す（ADR-0023）", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });
      mockDataSource.getCourseById.mockResolvedValue({ id: "course-2", enabled: true, visible: true, name: "Course 2" });
      mockDataSource.getEnrollments.mockResolvedValue([{ id: "e-1" }]);
      const existingSession = {
        id: "session-1",
        courseId: "course-1", // 別の講座
        userId: "user-1",
        startTime: new Date(),
        endTime: null,
        durationSec: 0,
        source: "manual",
        confidence: null,
        status: "open",
        lastHeartbeatAt: new Date(),
      };
      mockDataSource.getActiveSession.mockResolvedValue(existingSession);

      const res = await request(app).post("/sessions/check-in").send({ courseId: "course-2" });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("session_already_active");
    });

    it("新規チェックインが成功したら201を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });
      mockDataSource.getCourseById.mockResolvedValue({ id: "course-1", enabled: true, visible: true });
      mockDataSource.getEnrollments.mockResolvedValue([{ id: "e-1" }]);
      mockDataSource.getActiveSession.mockResolvedValue(null);
      mockDataSource.getSessions.mockResolvedValue([]); // ADR-0026: closedセッションなし
      const newSession = {
        id: "session-new",
        courseId: "course-1",
        userId: "user-1",
        startTime: new Date("2026-01-29T10:00:00Z"),
        endTime: null,
        durationSec: 0,
        source: "manual",
        confidence: null,
        status: "open",
        lastHeartbeatAt: new Date("2026-01-29T10:00:00Z"),
      };
      mockDataSource.checkInOrGetExisting.mockResolvedValue({ session: newSession, isExisting: false });

      const res = await request(app).post("/sessions/check-in").send({ courseId: "course-1" });

      expect(res.status).toBe(201);
      expect(res.body.isExisting).toBe(false);
    });

    it("既存セッションがある場合は200を返す（ADR-0012）", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });
      mockDataSource.getCourseById.mockResolvedValue({ id: "course-1", enabled: true, visible: true });
      mockDataSource.getEnrollments.mockResolvedValue([{ id: "e-1" }]);
      mockDataSource.getSessions.mockResolvedValue([]); // ADR-0026: closedセッションなし
      // 同じ講座のアクティブセッションがある
      const existingSession = {
        id: "session-existing",
        courseId: "course-1",
        userId: "user-1",
        startTime: new Date("2026-01-29T10:00:00Z"),
        endTime: null,
        durationSec: 0,
        source: "manual",
        confidence: null,
        status: "open",
        lastHeartbeatAt: new Date("2026-01-29T10:00:00Z"),
      };
      mockDataSource.getActiveSession.mockResolvedValue(existingSession);
      mockDataSource.checkInOrGetExisting.mockResolvedValue({ session: existingSession, isExisting: true });

      const res = await request(app).post("/sessions/check-in").send({ courseId: "course-1" });

      expect(res.status).toBe(200);
      expect(res.body.isExisting).toBe(true);
    });
  });

  describe("POST /sessions/heartbeat", () => {
    it("sessionIdがない場合は400を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });

      const res = await request(app).post("/sessions/heartbeat").send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_session_id");
    });

    it("存在しないセッションの場合は404を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });
      mockDataSource.getSessionById.mockResolvedValue(null);

      const res = await request(app).post("/sessions/heartbeat").send({ sessionId: "invalid" });

      expect(res.status).toBe(404);
    });

    it("他人のセッションの場合は403を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });
      mockDataSource.getSessionById.mockResolvedValue({ id: "session-1", userId: "other-user", status: "open" });

      const res = await request(app).post("/sessions/heartbeat").send({ sessionId: "session-1" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("forbidden");
    });

    it("クローズ済みセッションの場合は400を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });
      mockDataSource.getSessionById.mockResolvedValue({ id: "session-1", userId: "user-1", status: "closed" });

      const res = await request(app).post("/sessions/heartbeat").send({ sessionId: "session-1" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("session_closed");
    });

    it("正常にheartbeatを更新できる", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });
      const session = {
        id: "session-1",
        courseId: "course-1",
        userId: "user-1",
        startTime: new Date("2026-01-29T10:00:00Z"),
        endTime: null,
        durationSec: 0,
        source: "manual",
        confidence: null,
        status: "open",
        lastHeartbeatAt: new Date("2026-01-29T10:00:00Z"),
      };
      mockDataSource.getSessionById.mockResolvedValue(session);
      mockDataSource.updateSession.mockResolvedValue({
        ...session,
        lastHeartbeatAt: new Date("2026-01-29T10:01:00Z"),
      });

      const res = await request(app).post("/sessions/heartbeat").send({ sessionId: "session-1" });

      expect(res.status).toBe(200);
      expect(mockDataSource.updateSession).toHaveBeenCalledWith("session-1", expect.objectContaining({
        lastHeartbeatAt: expect.any(Date),
      }));
    });
  });

  describe("POST /sessions/check-out", () => {
    it("sessionIdがない場合は400を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });

      const res = await request(app).post("/sessions/check-out").send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_session_id");
    });

    it("必要視聴時間に達していない場合は400を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });
      // 30分前に開始したセッション
      const startTime = new Date(Date.now() - 30 * 60 * 1000);
      const session = {
        id: "session-1",
        courseId: "course-1",
        userId: "user-1",
        startTime,
        endTime: null,
        durationSec: 0,
        source: "manual",
        confidence: null,
        status: "open",
        lastHeartbeatAt: startTime,
      };
      mockDataSource.getSessionById.mockResolvedValue(session);
      mockDataSource.getCourseById.mockResolvedValue({
        id: "course-1",
        requiredWatchMin: 63, // 63分必要
      });

      const res = await request(app).post("/sessions/check-out").send({ sessionId: "session-1" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("not_enough_time");
      expect(res.body.requiredWatchMin).toBe(63);
      expect(res.body.remainingSec).toBeGreaterThan(0);
    });

    it("必要視聴時間を経過していればチェックアウトできる", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });
      // 70分前に開始したセッション
      const startTime = new Date(Date.now() - 70 * 60 * 1000);
      const session = {
        id: "session-1",
        courseId: "course-1",
        userId: "user-1",
        startTime,
        endTime: null,
        durationSec: 0,
        source: "manual",
        confidence: null,
        status: "open",
        lastHeartbeatAt: startTime,
      };
      mockDataSource.getSessionById.mockResolvedValue(session);
      mockDataSource.getCourseById.mockResolvedValue({
        id: "course-1",
        requiredWatchMin: 63,
      });
      mockDataSource.updateSession.mockResolvedValue({
        ...session,
        endTime: new Date(),
        status: "closed",
        durationSec: 4200,
      });

      const res = await request(app).post("/sessions/check-out").send({ sessionId: "session-1" });

      expect(res.status).toBe(200);
      expect(mockDataSource.updateSession).toHaveBeenCalledWith("session-1", expect.objectContaining({
        status: "closed",
      }));
    });
  });

  describe("POST /sessions/self-checkout", () => {
    it("通知が送信されていない場合は400を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });
      const session = {
        id: "session-1",
        courseId: "course-1",
        userId: "user-1",
        startTime: new Date(Date.now() - 120 * 60 * 1000),
        endTime: null,
        status: "open",
      };
      mockDataSource.getSessionById.mockResolvedValue(session);
      mockDataSource.getNotificationLog.mockResolvedValue(null); // 通知未送信

      const res = await request(app).post("/sessions/self-checkout").send({
        sessionId: "session-1",
        endTime: new Date().toISOString(),
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("notification_not_sent");
    });

    it("endTimeが必要視聴時間より前の場合は400を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });
      const startTime = new Date(Date.now() - 120 * 60 * 1000); // 2時間前
      const session = {
        id: "session-1",
        courseId: "course-1",
        userId: "user-1",
        startTime,
        endTime: null,
        status: "open",
      };
      mockDataSource.getSessionById.mockResolvedValue(session);
      mockDataSource.getNotificationLog.mockResolvedValue({ sentAt: new Date() });
      mockDataSource.getCourseById.mockResolvedValue({
        id: "course-1",
        requiredWatchMin: 63,
      });

      // startTimeの30分後（必要視聴時間63分未満）
      const earlyEndTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const res = await request(app).post("/sessions/self-checkout").send({
        sessionId: "session-1",
        endTime: earlyEndTime.toISOString(),
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("not_enough_time");
    });

    it("endTimeが未来の場合は400を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });
      const startTime = new Date(Date.now() - 120 * 60 * 1000);
      const session = {
        id: "session-1",
        courseId: "course-1",
        userId: "user-1",
        startTime,
        endTime: null,
        status: "open",
      };
      mockDataSource.getSessionById.mockResolvedValue(session);
      mockDataSource.getNotificationLog.mockResolvedValue({ sentAt: new Date() });
      mockDataSource.getCourseById.mockResolvedValue({
        id: "course-1",
        requiredWatchMin: 63,
      });

      // 1時間後（未来）
      const futureEndTime = new Date(Date.now() + 60 * 60 * 1000);

      const res = await request(app).post("/sessions/self-checkout").send({
        sessionId: "session-1",
        endTime: futureEndTime.toISOString(),
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_end_time");
    });

    it("正常なセルフチェックアウトが成功する", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });
      const startTime = new Date(Date.now() - 120 * 60 * 1000); // 2時間前
      const session = {
        id: "session-1",
        courseId: "course-1",
        userId: "user-1",
        startTime,
        endTime: null,
        durationSec: 0,
        source: "manual",
        confidence: null,
        status: "open",
        lastHeartbeatAt: startTime,
      };
      mockDataSource.getSessionById.mockResolvedValue(session);
      mockDataSource.getNotificationLog.mockResolvedValue({ sentAt: new Date() });
      mockDataSource.getCourseById.mockResolvedValue({
        id: "course-1",
        requiredWatchMin: 63,
      });

      // 1時間前にチェックアウト（startTimeから1時間後 = 必要視聴時間経過後）
      const endTime = new Date(startTime.getTime() + 70 * 60 * 1000);
      mockDataSource.updateSession.mockResolvedValue({
        ...session,
        endTime,
        status: "closed",
        durationSec: 4200,
      });

      const res = await request(app).post("/sessions/self-checkout").send({
        sessionId: "session-1",
        endTime: endTime.toISOString(),
      });

      expect(res.status).toBe(200);
      expect(mockDataSource.updateSession).toHaveBeenCalledWith("session-1", expect.objectContaining({
        status: "closed",
      }));
    });
  });

  describe("GET /admin/sessions", () => {
    it("管理者でない場合は403を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });

      const res = await request(app).get("/admin/sessions");

      expect(res.status).toBe(403);
    });

    it("管理者はセッション一覧を取得できる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      const sessions = [
        {
          id: "session-1",
          courseId: "course-1",
          userId: "user-1",
          startTime: new Date("2026-01-29T10:00:00Z"),
          endTime: null,
          durationSec: 0,
          source: "manual",
          confidence: null,
          status: "open",
          lastHeartbeatAt: new Date("2026-01-29T10:00:00Z"),
        },
      ];
      mockDataSource.getSessions.mockResolvedValue(sessions);

      const res = await request(app).get("/admin/sessions");

      expect(res.status).toBe(200);
      expect(res.body.sessions).toHaveLength(1);
    });
  });

  describe("POST /admin/sessions/:id/close", () => {
    it("管理者はセッションを強制終了できる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      const session = {
        id: "session-1",
        courseId: "course-1",
        userId: "user-1",
        startTime: new Date("2026-01-29T10:00:00Z"),
        endTime: null,
        durationSec: 0,
        source: "manual",
        confidence: null,
        status: "open",
        lastHeartbeatAt: new Date("2026-01-29T10:00:00Z"),
      };
      mockDataSource.getSessionById.mockResolvedValue(session);
      mockDataSource.updateSession.mockResolvedValue({
        ...session,
        endTime: new Date(),
        status: "closed",
      });

      const res = await request(app).post("/admin/sessions/session-1/close").send({});

      expect(res.status).toBe(200);
      expect(mockDataSource.updateSession).toHaveBeenCalledWith("session-1", expect.objectContaining({
        status: "closed",
      }));
    });

    it("既にクローズ済みの場合は400を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.getSessionById.mockResolvedValue({ id: "session-1", status: "closed" });

      const res = await request(app).post("/admin/sessions/session-1/close").send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("session_closed");
    });
  });
});
