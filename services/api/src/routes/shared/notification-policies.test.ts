/**
 * notification-policies.ts のユニットテスト
 *
 * テスト対象:
 * - GET /admin/notification-policies: 一覧取得、フィルタリング
 * - POST /admin/notification-policies: 作成、バリデーション、重複チェック
 * - PATCH /admin/notification-policies/:id: 更新、バリデーション
 * - DELETE /admin/notification-policies/:id: 削除
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import express from "express";
import request from "supertest";

// vi.hoisted でモック関数をホイスト前に定義
const mockDataSource = vi.hoisted(() => ({
  getNotificationPolicies: vi.fn(),
  getNotificationPolicyById: vi.fn(),
  createNotificationPolicy: vi.fn(),
  updateNotificationPolicy: vi.fn(),
  deleteNotificationPolicy: vi.fn(),
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
  const { notificationPoliciesRouter } = await import("./notification-policies.js");

  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    if (user) {
      req.user = user as Express.Request["user"];
    }
    req.dataSource = mockDataSource as unknown as Express.Request["dataSource"];
    next();
  });

  app.use("/", notificationPoliciesRouter);
  return app;
}

describe("notification-policies router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /admin/notification-policies", () => {
    it("管理者は通知ポリシー一覧を取得できる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const policies = [
        {
          id: "policy-1",
          scope: "global",
          courseId: null,
          userId: null,
          firstNotifyAfterMin: 60,
          repeatIntervalHours: 24,
          maxRepeatDays: 7,
          active: true,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      ];
      mockDataSource.getNotificationPolicies.mockResolvedValue(policies);

      const res = await request(app).get("/admin/notification-policies");

      expect(res.status).toBe(200);
      expect(res.body.policies).toHaveLength(1);
      expect(res.body.policies[0].scope).toBe("global");
    });

    it("scopeでフィルタリングできる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.getNotificationPolicies.mockResolvedValue([]);

      await request(app).get("/admin/notification-policies?scope=course");

      expect(mockDataSource.getNotificationPolicies).toHaveBeenCalledWith({
        scope: "course",
        active: undefined,
      });
    });

    it("activeでフィルタリングできる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.getNotificationPolicies.mockResolvedValue([]);

      await request(app).get("/admin/notification-policies?active=true");

      expect(mockDataSource.getNotificationPolicies).toHaveBeenCalledWith({
        scope: undefined,
        active: true,
      });
    });

    it("学生は403を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });

      const res = await request(app).get("/admin/notification-policies");

      expect(res.status).toBe(403);
    });
  });

  describe("POST /admin/notification-policies", () => {
    it("globalスコープのポリシーを作成できる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      mockDataSource.getNotificationPolicies.mockResolvedValue([]);
      const newPolicy = {
        id: "policy-new",
        scope: "global",
        courseId: null,
        userId: null,
        firstNotifyAfterMin: 60,
        repeatIntervalHours: 24,
        maxRepeatDays: 7,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDataSource.createNotificationPolicy.mockResolvedValue(newPolicy);

      const res = await request(app)
        .post("/admin/notification-policies")
        .send({ scope: "global" });

      expect(res.status).toBe(201);
      expect(res.body.policy.scope).toBe("global");
    });

    it("courseスコープにはcourseIdが必要", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const res = await request(app)
        .post("/admin/notification-policies")
        .send({ scope: "course" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_course_id");
    });

    it("userスコープにはuserIdが必要", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const res = await request(app)
        .post("/admin/notification-policies")
        .send({ scope: "user" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_user_id");
    });

    it("無効なscopeは400を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const res = await request(app)
        .post("/admin/notification-policies")
        .send({ scope: "invalid" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_scope");
    });

    it("firstNotifyAfterMinは非負数でなければならない", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const res = await request(app)
        .post("/admin/notification-policies")
        .send({ scope: "global", firstNotifyAfterMin: -1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_first_notify");
    });

    it("repeatIntervalHoursは正数でなければならない", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const res = await request(app)
        .post("/admin/notification-policies")
        .send({ scope: "global", repeatIntervalHours: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_repeat_interval");
    });

    it("maxRepeatDaysは非負数でなければならない", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const res = await request(app)
        .post("/admin/notification-policies")
        .send({ scope: "global", maxRepeatDays: -1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_max_repeat");
    });

    it("globalスコープは1つのみ許可（重複は409）", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      mockDataSource.getNotificationPolicies.mockResolvedValue([
        { id: "existing", scope: "global" },
      ]);

      const res = await request(app)
        .post("/admin/notification-policies")
        .send({ scope: "global" });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("policy_exists");
      expect(res.body.existingPolicyId).toBe("existing");
    });

    it("courseスコープは同じcourseIdで1つのみ許可", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      mockDataSource.getNotificationPolicies.mockResolvedValue([
        { id: "existing", scope: "course", courseId: "course-1" },
      ]);

      const res = await request(app)
        .post("/admin/notification-policies")
        .send({ scope: "course", courseId: "course-1" });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("policy_exists");
    });

    it("異なるcourseIdなら作成可能", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      mockDataSource.getNotificationPolicies.mockResolvedValue([
        { id: "existing", scope: "course", courseId: "course-1" },
      ]);
      const newPolicy = {
        id: "policy-new",
        scope: "course",
        courseId: "course-2",
        userId: null,
        firstNotifyAfterMin: 60,
        repeatIntervalHours: 24,
        maxRepeatDays: 7,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDataSource.createNotificationPolicy.mockResolvedValue(newPolicy);

      const res = await request(app)
        .post("/admin/notification-policies")
        .send({ scope: "course", courseId: "course-2" });

      expect(res.status).toBe(201);
    });
  });

  describe("PATCH /admin/notification-policies/:id", () => {
    it("ポリシーを更新できる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const existing = {
        id: "policy-1",
        scope: "global",
        firstNotifyAfterMin: 60,
        repeatIntervalHours: 24,
        maxRepeatDays: 7,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updated = { ...existing, firstNotifyAfterMin: 90 };

      mockDataSource.getNotificationPolicyById.mockResolvedValue(existing);
      mockDataSource.updateNotificationPolicy.mockResolvedValue(updated);

      const res = await request(app)
        .patch("/admin/notification-policies/policy-1")
        .send({ firstNotifyAfterMin: 90 });

      expect(res.status).toBe(200);
      expect(res.body.policy.firstNotifyAfterMin).toBe(90);
    });

    it("存在しないポリシーは404を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.getNotificationPolicyById.mockResolvedValue(null);

      const res = await request(app)
        .patch("/admin/notification-policies/invalid")
        .send({ active: false });

      expect(res.status).toBe(404);
    });

    it("無効なfirstNotifyAfterMinは400を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.getNotificationPolicyById.mockResolvedValue({ id: "policy-1" });

      const res = await request(app)
        .patch("/admin/notification-policies/policy-1")
        .send({ firstNotifyAfterMin: "invalid" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_first_notify");
    });

    it("無効なrepeatIntervalHoursは400を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.getNotificationPolicyById.mockResolvedValue({ id: "policy-1" });

      const res = await request(app)
        .patch("/admin/notification-policies/policy-1")
        .send({ repeatIntervalHours: -1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_repeat_interval");
    });
  });

  describe("DELETE /admin/notification-policies/:id", () => {
    it("ポリシーを削除できる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.getNotificationPolicyById.mockResolvedValue({ id: "policy-1" });
      mockDataSource.deleteNotificationPolicy.mockResolvedValue(undefined);

      const res = await request(app).delete("/admin/notification-policies/policy-1");

      expect(res.status).toBe(204);
      expect(mockDataSource.deleteNotificationPolicy).toHaveBeenCalledWith("policy-1");
    });

    it("存在しないポリシーは404を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.getNotificationPolicyById.mockResolvedValue(null);

      const res = await request(app).delete("/admin/notification-policies/invalid");

      expect(res.status).toBe(404);
    });
  });
});
