/**
 * courses.ts のユニットテスト
 *
 * テスト対象:
 * - GET /courses: 受講登録済み講座のみを返す
 * - GET /admin/courses: 全講座一覧
 * - POST /admin/courses: 講座作成
 * - PATCH /admin/courses/:id: 講座更新
 * - DELETE /admin/courses/:id: 講座削除（関連データチェック）
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import express from "express";
import request from "supertest";

// vi.hoisted でモック関数をホイスト前に定義
const mockDataSource = vi.hoisted(() => ({
  getCourses: vi.fn(),
  getCourseById: vi.fn(),
  getEnrollments: vi.fn(),
  getSessions: vi.fn(),
  createCourse: vi.fn(),
  updateCourse: vi.fn(),
  deleteCourse: vi.fn(),
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
async function createTestApp(user?: { id: string; role: string; email?: string }) {
  const { coursesRouter } = await import("./courses.js");

  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    if (user) {
      req.user = user as Express.Request["user"];
    }
    req.dataSource = mockDataSource as unknown as Express.Request["dataSource"];
    next();
  });

  app.use("/", coursesRouter);
  return app;
}

describe("courses router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /courses", () => {
    it("受講登録済みの講座のみを返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });

      // 講座は3つあるが、受講登録は1つのみ
      mockDataSource.getCourses.mockResolvedValue([
        { id: "course-1", name: "Course 1", enabled: true, visible: true, requiredWatchMin: 63 },
        { id: "course-2", name: "Course 2", enabled: true, visible: true, requiredWatchMin: 63 },
        { id: "course-3", name: "Course 3", enabled: true, visible: true, requiredWatchMin: 63 },
      ]);
      mockDataSource.getEnrollments.mockResolvedValue([
        { id: "enroll-1", userId: "user-1", courseId: "course-1" },
      ]);
      mockDataSource.getSessions.mockResolvedValue([]);

      const res = await request(app).get("/courses");

      expect(res.status).toBe(200);
      expect(res.body.courses).toHaveLength(1);
      expect(res.body.courses[0].id).toBe("course-1");
    });

    it("セッションサマリーを付与する", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });

      mockDataSource.getCourses.mockResolvedValue([
        { id: "course-1", name: "Course 1", enabled: true, visible: true, requiredWatchMin: 63 },
      ]);
      mockDataSource.getEnrollments.mockResolvedValue([
        { id: "enroll-1", userId: "user-1", courseId: "course-1" },
      ]);
      mockDataSource.getSessions.mockResolvedValue([
        {
          id: "session-1",
          courseId: "course-1",
          userId: "user-1",
          startTime: new Date("2026-01-28T10:00:00Z"),
          endTime: new Date("2026-01-28T11:00:00Z"),
          durationSec: 3600,
          status: "closed",
        },
        {
          id: "session-2",
          courseId: "course-1",
          userId: "user-1",
          startTime: new Date("2026-01-29T10:00:00Z"),
          endTime: null,
          durationSec: 0,
          status: "open",
        },
      ]);

      const res = await request(app).get("/courses");

      expect(res.status).toBe(200);
      expect(res.body.courses[0].sessionSummary).toEqual({
        lastSessionAt: "2026-01-28T10:00:00.000Z",
        totalDurationSec: 3600,
        sessionCount: 1,
        hasActiveSession: true,
        isCompleted: true, // ADR-0026
      });
    });

    it("受講登録がない場合は空配列を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });

      mockDataSource.getCourses.mockResolvedValue([
        { id: "course-1", name: "Course 1", enabled: true, visible: true },
      ]);
      mockDataSource.getEnrollments.mockResolvedValue([]);
      mockDataSource.getSessions.mockResolvedValue([]);

      const res = await request(app).get("/courses");

      expect(res.status).toBe(200);
      expect(res.body.courses).toHaveLength(0);
    });
  });

  describe("GET /admin/courses", () => {
    it("管理者は全講座を取得できる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      mockDataSource.getCourses.mockResolvedValue([
        {
          id: "course-1",
          name: "Course 1",
          enabled: true,
          visible: true,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
        {
          id: "course-2",
          name: "Course 2",
          enabled: false,
          visible: false,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      ]);

      const res = await request(app).get("/admin/courses");

      expect(res.status).toBe(200);
      expect(res.body.courses).toHaveLength(2);
    });

    it("学生は403を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });

      const res = await request(app).get("/admin/courses");

      expect(res.status).toBe(403);
    });
  });

  describe("POST /admin/courses", () => {
    it("管理者は講座を作成できる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const newCourse = {
        id: "course-new",
        name: "New Course",
        description: "Description",
        classroomUrl: "https://classroom.google.com",
        requiredWatchMin: 63,
        enabled: true,
        visible: true,
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDataSource.createCourse.mockResolvedValue(newCourse);

      const res = await request(app)
        .post("/admin/courses")
        .send({ name: "New Course", description: "Description" });

      expect(res.status).toBe(201);
      expect(res.body.course.name).toBe("New Course");
    });

    it("nameがない場合は400を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const res = await request(app).post("/admin/courses").send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_name");
    });

    it("nameが空文字の場合は400を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const res = await request(app).post("/admin/courses").send({ name: "   " });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_name");
    });
  });

  describe("PATCH /admin/courses/:id", () => {
    it("管理者は講座を更新できる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const existing = {
        id: "course-1",
        name: "Old Name",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updated = {
        ...existing,
        name: "New Name",
        updatedAt: new Date(),
      };

      mockDataSource.getCourseById.mockResolvedValue(existing);
      mockDataSource.updateCourse.mockResolvedValue(updated);

      const res = await request(app)
        .patch("/admin/courses/course-1")
        .send({ name: "New Name" });

      expect(res.status).toBe(200);
      expect(res.body.course.name).toBe("New Name");
    });

    it("存在しない講座は404を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.getCourseById.mockResolvedValue(null);

      const res = await request(app).patch("/admin/courses/invalid").send({ name: "New" });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /admin/courses/:id", () => {
    it("関連データがない講座を削除できる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      mockDataSource.getCourseById.mockResolvedValue({ id: "course-1", name: "Course" });
      mockDataSource.getSessions.mockResolvedValue([]);
      mockDataSource.getEnrollments.mockResolvedValue([]);
      mockDataSource.deleteCourse.mockResolvedValue(undefined);

      const res = await request(app).delete("/admin/courses/course-1");

      expect(res.status).toBe(204);
      expect(mockDataSource.deleteCourse).toHaveBeenCalledWith("course-1");
    });

    it("セッションがある講座は409を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      mockDataSource.getCourseById.mockResolvedValue({ id: "course-1", name: "Course" });
      mockDataSource.getSessions.mockResolvedValue([{ id: "session-1" }]);
      mockDataSource.getEnrollments.mockResolvedValue([]);

      const res = await request(app).delete("/admin/courses/course-1");

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("has_related_data");
      expect(res.body.details).toEqual({
        sessionCount: 1,
        enrollmentCount: 0,
      });
      expect(mockDataSource.deleteCourse).not.toHaveBeenCalled();
    });

    it("受講登録がある講座は409を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      mockDataSource.getCourseById.mockResolvedValue({ id: "course-1", name: "Course" });
      mockDataSource.getSessions.mockResolvedValue([]);
      mockDataSource.getEnrollments.mockResolvedValue([{ id: "enroll-1" }, { id: "enroll-2" }]);

      const res = await request(app).delete("/admin/courses/course-1");

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("has_related_data");
      expect(res.body.details).toEqual({
        sessionCount: 0,
        enrollmentCount: 2,
      });
    });

    it("存在しない講座は404を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.getCourseById.mockResolvedValue(null);

      const res = await request(app).delete("/admin/courses/invalid");

      expect(res.status).toBe(404);
    });
  });
});
