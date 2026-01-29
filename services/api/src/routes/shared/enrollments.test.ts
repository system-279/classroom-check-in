/**
 * enrollments.ts のユニットテスト
 *
 * テスト対象:
 * - GET /admin/enrollments: 受講登録一覧
 * - POST /admin/enrollments: 受講登録作成（重複チェック）
 * - POST /admin/enrollments/bulk: 一括受講登録
 * - PATCH /admin/enrollments/:id: 受講登録更新
 * - DELETE /admin/enrollments/:id: 受講登録削除
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import express from "express";
import request from "supertest";

// vi.hoisted でモック関数をホイスト前に定義
const mockDataSource = vi.hoisted(() => ({
  getEnrollments: vi.fn(),
  getEnrollmentById: vi.fn(),
  getCourseById: vi.fn(),
  getUserById: vi.fn(),
  createEnrollment: vi.fn(),
  updateEnrollment: vi.fn(),
  deleteEnrollment: vi.fn(),
}));

// モック設定
vi.mock("../../middleware/auth.js", () => ({
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
  const { enrollmentsRouter } = await import("./enrollments.js");

  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    if (user) {
      req.user = user as Express.Request["user"];
    }
    req.dataSource = mockDataSource as unknown as Express.Request["dataSource"];
    next();
  });

  app.use("/", enrollmentsRouter);
  return app;
}

describe("enrollments router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /admin/enrollments", () => {
    it("管理者は受講登録一覧を取得できる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const enrollments = [
        {
          id: "enroll-1",
          courseId: "course-1",
          userId: "user-1",
          role: "student",
          startAt: new Date("2026-01-01"),
          endAt: null,
          createdAt: new Date("2026-01-01"),
        },
      ];
      mockDataSource.getEnrollments.mockResolvedValue(enrollments);

      const res = await request(app).get("/admin/enrollments");

      expect(res.status).toBe(200);
      expect(res.body.enrollments).toHaveLength(1);
      expect(res.body.enrollments[0].id).toBe("enroll-1");
    });

    it("courseIdでフィルタリングできる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.getEnrollments.mockResolvedValue([]);

      await request(app).get("/admin/enrollments?courseId=course-1");

      expect(mockDataSource.getEnrollments).toHaveBeenCalledWith({ courseId: "course-1", userId: undefined });
    });

    it("学生は403を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });

      const res = await request(app).get("/admin/enrollments");

      expect(res.status).toBe(403);
    });
  });

  describe("POST /admin/enrollments", () => {
    it("受講登録を作成できる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      mockDataSource.getCourseById.mockResolvedValue({ id: "course-1", name: "Course" });
      mockDataSource.getUserById.mockResolvedValue({ id: "user-1", name: "User" });
      mockDataSource.getEnrollments.mockResolvedValue([]);
      const newEnrollment = {
        id: "enroll-new",
        courseId: "course-1",
        userId: "user-1",
        role: "student",
        startAt: new Date(),
        endAt: null,
        createdAt: new Date(),
      };
      mockDataSource.createEnrollment.mockResolvedValue(newEnrollment);

      const res = await request(app)
        .post("/admin/enrollments")
        .send({ courseId: "course-1", userId: "user-1" });

      expect(res.status).toBe(201);
      expect(res.body.enrollment.id).toBe("enroll-new");
    });

    it("courseIdがない場合は400を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const res = await request(app)
        .post("/admin/enrollments")
        .send({ userId: "user-1" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_course_id");
    });

    it("userIdがない場合は400を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const res = await request(app)
        .post("/admin/enrollments")
        .send({ courseId: "course-1" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_user_id");
    });

    it("存在しない講座の場合は404を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.getCourseById.mockResolvedValue(null);

      const res = await request(app)
        .post("/admin/enrollments")
        .send({ courseId: "invalid", userId: "user-1" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("course_not_found");
    });

    it("存在しないユーザーの場合は404を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.getCourseById.mockResolvedValue({ id: "course-1" });
      mockDataSource.getUserById.mockResolvedValue(null);

      const res = await request(app)
        .post("/admin/enrollments")
        .send({ courseId: "course-1", userId: "invalid" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("user_not_found");
    });

    it("重複登録は409を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.getCourseById.mockResolvedValue({ id: "course-1" });
      mockDataSource.getUserById.mockResolvedValue({ id: "user-1" });
      mockDataSource.getEnrollments.mockResolvedValue([{ id: "existing" }]); // 既存あり

      const res = await request(app)
        .post("/admin/enrollments")
        .send({ courseId: "course-1", userId: "user-1" });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("enrollment_exists");
    });
  });

  describe("POST /admin/enrollments/bulk", () => {
    it("一括受講登録ができる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      mockDataSource.getUserById.mockResolvedValue({ id: "user-1" });
      mockDataSource.getEnrollments.mockResolvedValue([]); // 既存登録なし
      mockDataSource.getCourseById.mockImplementation((id: string) => {
        if (id === "course-1" || id === "course-2") {
          return Promise.resolve({ id, name: `Course ${id}` });
        }
        return Promise.resolve(null);
      });
      mockDataSource.createEnrollment.mockImplementation((data) =>
        Promise.resolve({
          id: `enroll-${data.courseId}`,
          ...data,
          createdAt: new Date(),
        })
      );

      const res = await request(app)
        .post("/admin/enrollments/bulk")
        .send({ userId: "user-1", courseIds: ["course-1", "course-2", "invalid"] });

      expect(res.status).toBe(201);
      expect(res.body.summary.created).toBe(2);
      expect(res.body.summary.notFound).toBe(1);
      expect(res.body.notFound).toContain("invalid");
    });

    it("既存の登録はスキップする", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      mockDataSource.getUserById.mockResolvedValue({ id: "user-1" });
      mockDataSource.getEnrollments.mockResolvedValue([
        { id: "exist-1", courseId: "course-1", userId: "user-1" }, // 既存
      ]);
      mockDataSource.getCourseById.mockResolvedValue({ id: "course-2", name: "Course 2" });
      mockDataSource.createEnrollment.mockResolvedValue({
        id: "enroll-course-2",
        courseId: "course-2",
        userId: "user-1",
        role: "student",
        startAt: new Date(),
        endAt: null,
        createdAt: new Date(),
      });

      const res = await request(app)
        .post("/admin/enrollments/bulk")
        .send({ userId: "user-1", courseIds: ["course-1", "course-2"] });

      expect(res.status).toBe(201);
      expect(res.body.summary.created).toBe(1);
      expect(res.body.summary.skipped).toBe(1);
      expect(res.body.skipped).toContain("course-1");
    });

    it("userIdがない場合は400を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const res = await request(app)
        .post("/admin/enrollments/bulk")
        .send({ courseIds: ["course-1"] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_user_id");
    });

    it("courseIdsが空の場合は400を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const res = await request(app)
        .post("/admin/enrollments/bulk")
        .send({ userId: "user-1", courseIds: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_course_ids");
    });
  });

  describe("PATCH /admin/enrollments/:id", () => {
    it("受講登録を更新できる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const existing = {
        id: "enroll-1",
        courseId: "course-1",
        userId: "user-1",
        role: "student",
        startAt: new Date(),
        endAt: null,
        createdAt: new Date(),
      };
      const updated = { ...existing, role: "teacher" };

      mockDataSource.getEnrollmentById.mockResolvedValue(existing);
      mockDataSource.updateEnrollment.mockResolvedValue(updated);

      const res = await request(app)
        .patch("/admin/enrollments/enroll-1")
        .send({ role: "teacher" });

      expect(res.status).toBe(200);
      expect(res.body.enrollment.role).toBe("teacher");
    });

    it("存在しない受講登録は404を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.getEnrollmentById.mockResolvedValue(null);

      const res = await request(app)
        .patch("/admin/enrollments/invalid")
        .send({ role: "teacher" });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /admin/enrollments/:id", () => {
    it("受講登録を削除できる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.getEnrollmentById.mockResolvedValue({ id: "enroll-1" });
      mockDataSource.deleteEnrollment.mockResolvedValue(undefined);

      const res = await request(app).delete("/admin/enrollments/enroll-1");

      expect(res.status).toBe(204);
      expect(mockDataSource.deleteEnrollment).toHaveBeenCalledWith("enroll-1");
    });

    it("存在しない受講登録は404を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.getEnrollmentById.mockResolvedValue(null);

      const res = await request(app).delete("/admin/enrollments/invalid");

      expect(res.status).toBe(404);
    });
  });
});
